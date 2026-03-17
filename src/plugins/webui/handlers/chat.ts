/**
 * @module plugins/webui/handlers/chat
 *
 * POST /api/chat handler — streaming chat via SSE.
 * Validates the request, creates/reuses a session, runs the agent loop
 * with callbacks that emit SSE events: text-delta, tool-call-start,
 * tool-call-result, done, error.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext, StructuredLogger } from '../../../core/kernel/contracts.js';
import type { SlashbotKernel } from '../../../core/kernel/kernel.js';
import type { AuthProfileRouter } from '../../../core/providers/auth-router.js';
import type { ProviderRegistry } from '../../../core/kernel/registries.js';
import type { TokenModeProxyAuthService, AgentMessage } from '../../../core/agentic/llm/types.js';
import type { AgentLoopCallbacks } from '../../../core/agentic/agent-loop.js';
import { KernelLlmAdapter } from '../../../core/agentic/llm/adapter.js';
import { ChatRequestSchema } from '../types.js';
import type { ConversationMessage } from '../types.js';
import { writeSseHeaders, writeEvent, startKeepalive } from '../sse.js';
import type { ConversationStore } from '../services/conversation-store.js';

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

  const conversationStore = context.getService<ConversationStore>('webui.conversations');
  if (!conversationStore) throw new Error("webui: required service 'webui.conversations' not available");

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

    // Set up abort controller for client disconnect
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    // Start SSE stream
    writeSseHeaders(res);
    const stopKeepalive = startKeepalive(res);

    try {
      // Build conversation history
      let sessionId: string;
      let history: AgentMessage[] = [];

      if (requestedSessionId) {
        sessionId = requestedSessionId;
        const existing = await conversationStore.get(sessionId);
        if (existing) {
          history = existing.messages.map(m => m.msg as unknown as AgentMessage);
        }
      } else {
        const created = await conversationStore.create();
        sessionId = created.id;
      }

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

      // Persist messages to conversation store
      const now = new Date().toISOString();
      const newMessages: ConversationMessage[] = [
        { ts: now, msg: { role: 'user', content: message } as Record<string, unknown> },
      ];
      if (result.text) {
        newMessages.push({ ts: now, msg: { role: 'assistant', content: result.text } as Record<string, unknown> });
      }
      // Include tool call messages from agent loop result if available
      if (result.messages) {
        const toolMessages: ConversationMessage[] = result.messages
          .filter(m => 'toolCalls' in m || m.role === 'tool')
          .map(m => ({ ts: now, msg: m as unknown as Record<string, unknown> }));
        if (toolMessages.length > 0) {
          // Insert tool messages between user and assistant messages
          newMessages.splice(1, 0, ...toolMessages);
        }
      }
      await conversationStore.append(sessionId, newMessages);

      // Fire-and-forget title generation on first exchange
      if (!requestedSessionId) {
        const titleAdapter = {
          complete: async (prompt: string) => {
            const titleResult = await llm.complete(
              {
                sessionId: `title-${sessionId}`,
                agentId: 'webui-title',
                messages: [
                  { role: 'system', content: 'You are a concise title generator. Reply with ONLY the title.' },
                  { role: 'user', content: prompt },
                ],
                noTools: true,
                maxTokens: 30,
                maxSteps: 1,
              },
              {},
            );
            return titleResult.text ?? '';
          },
        };
        conversationStore.generateTitle(sessionId, titleAdapter).then(title => {
          if (title && !res.writableEnded) {
            writeEvent(res, {
              type: 'conversation-update' as const,
              payload: { id: sessionId, title, updatedAt: new Date().toISOString() },
            });
          }
        }).catch(() => { /* title generation failure is non-critical */ });
      }

      // Update preview with last assistant text
      if (result.text) {
        const preview = result.text.slice(0, 100);
        conversationStore.updatePreview(sessionId, preview).catch(() => {});
      }

      if (!res.writableEnded) {
        writeEvent(res, {
          type: 'conversation-update' as const,
          payload: { id: sessionId, updatedAt: now },
        });
      }
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
