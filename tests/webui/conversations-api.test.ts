/**
 * Integration tests for conversation API handlers.
 * Tests handler factories directly without an HTTP server.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationStore } from '../../src/plugins/webui/services/conversation-store.js';
import {
  createListConversationsHandler,
  createGetConversationHandler,
  createDeleteConversationHandler,
} from '../../src/plugins/webui/handlers/conversations.js';
import type { PluginRegistrationContext, GatewayCallContext } from '../../src/core/kernel/contracts.js';
import { createTempConversationsDir, cleanupTempDir } from './setup.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(url: string): IncomingMessage {
  return { url } as IncomingMessage;
}

function mockRes(): ServerResponse & { _status: number; _body: string; _headers: Record<string, string> } {
  const res = {
    _status: 200,
    _body: '',
    _headers: {} as Record<string, string>,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
    },
    end(body?: string) {
      if (body) res._body = body;
    },
    writableEnded: false,
  };
  return res as unknown as ServerResponse & { _status: number; _body: string; _headers: Record<string, string> };
}

function buildContext(store: ConversationStore): PluginRegistrationContext {
  return {
    getService: <T>(id: string): T | undefined => {
      if (id === 'webui.conversations') return store as unknown as T;
      return undefined;
    },
  } as PluginRegistrationContext;
}

const ctx = {} as GatewayCallContext;

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let dir: string;
let store: ConversationStore;
let context: PluginRegistrationContext;

beforeEach(async () => {
  dir = await createTempConversationsDir();
  store = new ConversationStore(dir);
  await store.init();
  context = buildContext(store);
});

afterEach(async () => {
  await cleanupTempDir(dir);
});

// ---------------------------------------------------------------------------
// GET /api/conversations (listConversations)
// ---------------------------------------------------------------------------

describe('createListConversationsHandler', () => {
  it('returns empty array when no conversations exist', async () => {
    const handler = createListConversationsHandler(context);
    const req = mockReq('/api/conversations');
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.conversations).toEqual([]);
  });

  it('returns conversations sorted by updatedAt desc after creating 2', async () => {
    const a = await store.create();
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.create();

    const handler = createListConversationsHandler(context);
    const req = mockReq('/api/conversations');
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.conversations).toHaveLength(2);
    expect(body.conversations[0].id).toBe(b.id);
    expect(body.conversations[1].id).toBe(a.id);
  });
});

// ---------------------------------------------------------------------------
// GET /api/conversations/:id (getConversation)
// ---------------------------------------------------------------------------

describe('createGetConversationHandler', () => {
  it('returns 404 for unknown UUID', async () => {
    const handler = createGetConversationHandler(context);
    const req = mockReq('/api/conversations/00000000-0000-4000-8000-000000000000');
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(404);
    const body = JSON.parse(res._body);
    expect(body.error).toBeDefined();
  });

  it('returns 400 for non-UUID string', async () => {
    const handler = createGetConversationHandler(context);
    const req = mockReq('/api/conversations/not-a-uuid');
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(400);
    const body = JSON.parse(res._body);
    expect(body.error).toBeDefined();
  });

  it('returns conversation with messages after creating and appending', async () => {
    const meta = await store.create();
    const msg = { ts: new Date().toISOString(), msg: { role: 'user', content: 'hello' } };
    await store.append(meta.id, [msg]);

    const handler = createGetConversationHandler(context);
    const req = mockReq(`/api/conversations/${meta.id}`);
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.id).toBe(meta.id);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].msg.content).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/conversations/:id (deleteConversation)
// ---------------------------------------------------------------------------

describe('createDeleteConversationHandler', () => {
  it('returns 404 for unknown UUID', async () => {
    const handler = createDeleteConversationHandler(context);
    const req = mockReq('/api/conversations/00000000-0000-4000-8000-000000000000');
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(404);
    const body = JSON.parse(res._body);
    expect(body.error).toBeDefined();
  });

  it('returns 400 for non-UUID string', async () => {
    const handler = createDeleteConversationHandler(context);
    const req = mockReq('/api/conversations/not-a-uuid');
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(400);
  });

  it('deletes existing conversation and returns { deleted: true }', async () => {
    const meta = await store.create();
    const handler = createDeleteConversationHandler(context);
    const req = mockReq(`/api/conversations/${meta.id}`);
    const res = mockRes();

    await handler(req, res, ctx);

    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.deleted).toBe(true);

    // Verify it's gone
    const list = await store.list();
    expect(list.find(c => c.id === meta.id)).toBeUndefined();
  });
});
