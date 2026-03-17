/**
 * @module plugins/webui/handlers/conversations
 *
 * GET /api/conversations handler — returns list of conversations as JSON.
 * GET /api/conversations/:id handler — returns a single conversation with messages.
 * DELETE /api/conversations/:id handler — deletes a conversation.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import type { ConversationStore } from '../services/conversation-store.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createListConversationsHandler(context: PluginRegistrationContext) {
  const store = context.getService<ConversationStore>('webui.conversations');
  if (!store) throw new Error("webui: required service 'webui.conversations' not available");

  return async function handleListConversations(
    _req: IncomingMessage,
    res: ServerResponse,
    _ctx: GatewayCallContext,
  ): Promise<void> {
    try {
      const conversations = await store.list();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ conversations }));
    } catch {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}

export function createGetConversationHandler(context: PluginRegistrationContext) {
  const store = context.getService<ConversationStore>('webui.conversations');
  if (!store) throw new Error("webui: required service 'webui.conversations' not available");

  return async function handleGetConversation(
    req: IncomingMessage,
    res: ServerResponse,
    _ctx: GatewayCallContext,
  ): Promise<void> {
    const id = req.url?.split('/').pop() ?? '';

    if (!UUID_REGEX.test(id)) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid conversation ID' }));
      return;
    }

    try {
      const result = await store.get(id);
      if (!result) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation not found' }));
        return;
      }

      const { metadata, messages } = result;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: metadata.id,
          title: metadata.title,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          messages,
        }),
      );
    } catch {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}

export function createDeleteConversationHandler(context: PluginRegistrationContext) {
  const store = context.getService<ConversationStore>('webui.conversations');
  if (!store) throw new Error("webui: required service 'webui.conversations' not available");

  return async function handleDeleteConversation(
    req: IncomingMessage,
    res: ServerResponse,
    _ctx: GatewayCallContext,
  ): Promise<void> {
    const id = req.url?.split('/').pop() ?? '';

    if (!UUID_REGEX.test(id)) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid conversation ID' }));
      return;
    }

    try {
      const deleted = await store.delete(id);
      if (!deleted) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation not found' }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ deleted: true }));
    } catch {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}
