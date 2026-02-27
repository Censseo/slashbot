/**
 * @module llm/completion-runner
 *
 * Unified completion logic for both streaming and non-streaming LLM calls.
 * Provides an abstraction layer ({@link SdkCaller}) over the AI SDK's
 * generateText/streamText, with token-mode proxy support.
 *
 * @see {@link runCompletion} — Main entry point for running a completion
 * @see {@link makeStreamCaller} — Factory for streaming callers
 * @see {@link generateCaller} — Non-streaming caller
 */
import { generateText, streamText } from 'ai';
import type {
  AgentMessageContent,
  CompletionExecution,
  LlmCompletionInput,
  RunCompletionDeps,
  StreamingCallback,
} from './types.js';
import {
  asTextOnly,
  extractToken,
  fallbackChatResponse,
  getRequestBodyText,
  hasImageContent,
  isAbortError,
  mapMessages,
} from './helpers.js';
import { getProviderConfig, getProviderFactory } from './provider-registry.js';

// ---------------------------------------------------------------------------
// SdkCaller — abstraction over generateText / streamText
// ---------------------------------------------------------------------------

/**
 * Abstraction over generateText/streamText. Takes a model, messages, config,
 * and abort signal, returning the full response text as a promise.
 */
export type SdkCaller = (
  model: unknown,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: AgentMessageContent | string }>,
  config: { maxTokens: number },
  abortSignal: AbortSignal,
) => Promise<string>;

/** Non-streaming caller wrapping generateText. */
export const generateCaller: SdkCaller = async (model, messages, config, abortSignal) => {
  const { text } = await generateText({
    model: model as Parameters<typeof generateText>[0]['model'],
    maxOutputTokens: config.maxTokens,
    maxRetries: 0,
    messages: messages as never,
    abortSignal,
  });
  return text;
};

/** Creates a streaming caller that pipes tokens through a StreamingCallback. */
export function makeStreamCaller(callback: StreamingCallback): SdkCaller {
  return async (model, messages, config, abortSignal) => {
    const result = streamText({
      model: model as Parameters<typeof streamText>[0]['model'],
      maxOutputTokens: config.maxTokens,
      maxRetries: 0,
      messages: messages as never,
      abortSignal,
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      callback.onToken(chunk);
    }
    return fullText;
  };
}

// ---------------------------------------------------------------------------
// runCompletion — unified completion logic
// ---------------------------------------------------------------------------

async function callWithExecution(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: AgentMessageContent | string }>,
  execution: CompletionExecution,
  abortSignal: AbortSignal,
  caller: SdkCaller,
  maxTokensOverride?: number,
): Promise<string> {
  const factory = getProviderFactory(execution.providerId);
  if (!factory) {
    throw new Error(`provider unsupported for ai sdk adapter: ${execution.providerId}`);
  }

  const model = factory(execution);
  const config = getProviderConfig(execution.providerId);
  const effectiveConfig = {
    ...config,
    ...(maxTokensOverride ? { maxTokens: maxTokensOverride } : {}),
  };

  return caller(model, messages, effectiveConfig, abortSignal);
}

/**
 * Runs a text completion with multi-provider failover, token-mode proxy support,
 * rate-limit tracking, and image content fallback. Does not support tool use.
 *
 * @param input - Completion input with messages, session info, and options
 * @param deps - Runtime dependencies (auth router, providers, logger)
 * @param caller - SDK caller implementation (streaming or non-streaming)
 * @returns The full response text, or a fallback message on failure
 */
export async function runCompletion(
  input: LlmCompletionInput,
  deps: RunCompletionDeps,
  caller: SdkCaller,
): Promise<string> {
  const config = getProviderConfig('_fallback_sentinel_');
  const timeoutMs = config.timeoutMs;

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  const onAbort = () => abortController.abort();
  if (input.abortSignal) {
    if (input.abortSignal.aborted) { abortController.abort(); }
    else { input.abortSignal.addEventListener('abort', onAbort, { once: true }); }
  }

  const maxTok = input.maxTokens;

  try {
    const messages = mapMessages(input.messages);

    // -----------------------------------------------------------------------
    // Token-mode proxy path
    // -----------------------------------------------------------------------
    const tokenModeProxy = deps.resolveTokenModeProxy();
    const proxyProbe = tokenModeProxy
      ? await tokenModeProxy.resolveProxyRequest('')
      : null;

    if (proxyProbe?.enabled) {
      const baseUrl = proxyProbe.baseUrl?.trim();
      if (!baseUrl) {
        return fallbackChatResponse();
      }

      const modelId = deps.selectModelForProvider('xai') ?? 'grok-4-1-fast-reasoning';
      const proxyFetch = async (request: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const requestBody = getRequestBodyText(init?.body);
        const liveProxy = deps.resolveTokenModeProxy();
        if (!liveProxy) {
          throw new Error('Token mode proxy auth service unavailable.');
        }
        const resolvedProxy = await liveProxy.resolveProxyRequest(requestBody);
        if (!resolvedProxy.enabled) {
          throw new Error(resolvedProxy.reason || 'Token mode proxy auth unavailable.');
        }

        const mergedHeaders = new Headers(init?.headers as HeadersInit | undefined);
        mergedHeaders.delete('authorization');
        mergedHeaders.delete('api-key');
        mergedHeaders.delete('x-api-key');

        for (const [key, value] of Object.entries(resolvedProxy.headers ?? {})) {
          if (value !== undefined && value !== null && value !== '') {
            mergedHeaders.set(key, String(value));
          }
        }

        return fetch(request, {
          ...(init ?? {}),
          headers: mergedHeaders,
        });
      };

      const execution: CompletionExecution = {
        providerId: 'xai',
        modelId,
        token: 'token-mode-placeholder',
        baseUrl,
        customFetch: proxyFetch,
      };

      try {
        return await callWithExecution(messages, execution, abortController.signal, caller, maxTok);
      } catch (error) {
        if (!hasImageContent(messages)) {
          throw error;
        }
        const reason = error instanceof Error ? error.message : String(error);
        deps.logger.warn('Model rejected image input, retrying with text-only message', {
          providerId: execution.providerId,
          modelId: execution.modelId,
          reason,
        });
        const fallbackMessages = asTextOnly(messages);
        return await callWithExecution(fallbackMessages, execution, abortController.signal, caller, maxTok);
      }
    }

    // -----------------------------------------------------------------------
    // Direct auth path — single attempt, no retry/failover
    // -----------------------------------------------------------------------
    if (proxyProbe?.reason) {
      return fallbackChatResponse();
    }

    const resolved = await deps.authRouter.resolve({
      agentId: input.agentId,
      sessionId: input.sessionId,
    });

    const provider = deps.providers.get(resolved.providerId);
    if (!provider) {
      throw new Error(`provider not found: ${resolved.providerId}`);
    }

    const token = extractToken(resolved.profile);
    if (!token) {
      throw new Error(`no token in profile ${resolved.profile.profileId}`);
    }

    const profileBaseUrl = typeof resolved.profile.data.baseUrl === 'string' ? resolved.profile.data.baseUrl : undefined;

    const execution: CompletionExecution = {
      providerId: provider.id,
      modelId: deps.selectModelForProvider(provider.id, resolved.modelId) ?? resolved.modelId,
      token,
      ...(profileBaseUrl ? { baseUrl: profileBaseUrl } : {}),
    };

    return await callWithExecution(messages, execution, abortController.signal, caller, maxTok);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (isAbortError(error)) {
      deps.logger.info('LLM completion aborted', { reason });
      return 'Operation cancelled.';
    }

    deps.logger.warn('AI SDK completion failed, fallback selected', { reason });
    return fallbackChatResponse();
  } finally {
    clearTimeout(timeout);
    input.abortSignal?.removeEventListener('abort', onAbort);
  }
}
