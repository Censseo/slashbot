/**
 * @module plugins/webui/handlers/chat
 *
 * POST /api/chat handler — streaming chat via SSE.
 * Validates the request, creates/reuses a session, runs the agent loop
 * with callbacks that emit SSE events: text-delta, tool-call-start,
 * tool-call-result, done, error.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { PluginRegistrationContext, GatewayCallContext, StructuredLogger } from '../../../core/kernel/contracts.js';
import type { SlashbotKernel } from '../../../core/kernel/kernel.js';
import type { AuthProfileRouter } from '../../../core/providers/auth-router.js';
import type { ProviderRegistry } from '../../../core/kernel/registries.js';
import type { TokenModeProxyAuthService, AgentMessage } from '../../../core/agentic/llm/types.js';
import type { AgentLoopCallbacks } from '../../../core/agentic/agent-loop.js';
import { KernelLlmAdapter } from '../../../core/agentic/llm/adapter.js';
import { ChatRequestSchema } from '../types.js';
import { writeSseHeaders, writeEvent, startKeepalive } from '../sse.js';

// Intentional: uses simple Map instead of SessionManager. Web sessions are ephemeral
// HTTP-scoped, not persistent conversation sessions.
const sessions = new Map<string, AgentMessage[]>();

const BODY_SIZE_LIMIT = 65536;

async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > BODY_SIZE_LIMIT) {
      return null;
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Create the chat handler factory. Called once during plugin setup.
 */
export function createChatHandler(context: PluginRegistrationContext) {
  const kernel = context.getService<SlashbotKernel>('kernel.instance');
  if (!kernel) throw new Error("webui: required service 'kernel.instance' not available");

  const authRouter = context.getService<AuthProfileRouter>('kernel.authRouter');
  if (!authRouter) throw new Error("webui: required service 'kernel.authRouter' not available");

  const providers = context.getService<ProviderRegistry>('kernel.providers.registry');
  if (!providers) throw new Error("webui: required service 'kernel.providers.registry' not available");

  const logger = context.getService<StructuredLogger>('kernel.logger') ?? context.logger;

  const llm = new KernelLlmAdapter(
    authRouter,
    providers,
    logger,
    kernel,
    () => context.getService<TokenModeProxyAuthService>('wallet.proxyAuth'),
  );

  return async function handleChat(req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    // Parse and validate request body
    let body: unknown;
    try {
      const raw = await readBody(req);
      if (raw === null) {
        res.writeHead(413, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body exceeds 64KB limit' }));
        return;
      }
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: parsed.error.message }));
      return;
    }

    const { message, sessionId: requestedSessionId } = parsed.data;
    const sessionId = requestedSessionId ?? `web-${randomUUID()}`;

    // Set up abort controller for client disconnect
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    // Start SSE stream
    writeSseHeaders(res);
    const stopKeepalive = startKeepalive(res);

    try {
      // Build conversation history
      const history = sessions.get(sessionId) ?? [];

      // Assemble system prompt
      const systemPrompt = await kernel.assemblePrompt();

      // Build messages array
      const messages: AgentMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ];

      // Agent loop callbacks → SSE events
      const callbacks: AgentLoopCallbacks = {
        onThoughts(text) {
          if (text && !res.writableEnded) {
            writeEvent(res, { type: 'text-delta', payload: { text } });
          }
        },
        onToolStart(action) {
          if (!res.writableEnded) {
            writeEvent(res, {
              type: 'tool-call-start',
              payload: {
                toolId: action.id,
                toolName: action.name,
                args: action.args,
              },
            });
          }
        },
        onToolEnd(action) {
          if (!res.writableEnded) {
            writeEvent(res, {
              type: 'tool-call-result',
              payload: {
                toolId: action.id,
                toolName: action.name,
                result: action.result ?? '',
                success: action.status === 'done',
              },
            });
          }
        },
        onDone() {
          if (!res.writableEnded) {
            writeEvent(res, { type: 'done', payload: { sessionId } });
          }
        },
      };

      // Run agent loop with SSE callbacks
      const result = await llm.complete(
        {
          sessionId,
          agentId: 'webui',
          messages,
          abortSignal: abortController.signal,
        },
        callbacks,
      );

      // Update session history
      history.push({ role: 'user', content: message });
      if (result.text) {
        history.push({ role: 'assistant', content: result.text });
      }
      // Evict oldest session if over capacity to prevent unbounded memory growth
      if (!sessions.has(sessionId) && sessions.size > 500) {
        const oldest = sessions.keys().next().value;
        if (oldest !== undefined) sessions.delete(oldest);
      }
      sessions.set(sessionId, history);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      if (!res.writableEnded) {
        writeEvent(res, {
          type: 'error',
          payload: { message: error instanceof Error ? error.message : String(error) },
        });
      }
    } finally {
      stopKeepalive();
      if (!res.writableEnded) {
        res.end();
      }
    }
  };
}
