/**
 * T030 — Integration tests for the chat handler (createChatHandler)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

// ---------------------------------------------------------------------------
// Mock KernelLlmAdapter before importing the handler
// ---------------------------------------------------------------------------

const mockComplete = vi.fn();

vi.mock('../../../../src/core/agentic/llm/adapter.js', () => ({
  KernelLlmAdapter: vi.fn().mockImplementation(() => ({
    complete: mockComplete,
  })),
}));

// Import AFTER mocks are set up
import { createChatHandler } from '../../../../src/plugins/webui/handlers/chat.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockReq(method: string, url: string, body?: string): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  if (body !== undefined) {
    req.push(Buffer.from(body));
    req.push(null);
  }
  return req;
}

interface MockRes {
  res: ServerResponse;
  getBody: () => string;
  statusCode: () => number;
}

function createMockRes(): MockRes {
  const socket = new Socket();
  const reqForRes = new IncomingMessage(socket);
  const res = new ServerResponse(reqForRes);

  const chunks: Buffer[] = [];
  let capturedStatusCode = 200;

  const origWriteHead = res.writeHead.bind(res);
  (res as any).writeHead = (code: number, headers?: any) => {
    capturedStatusCode = code;
    return origWriteHead(code, headers);
  };

  res.write = ((chunk: any) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }) as any;

  res.end = ((chunk?: any) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    Object.defineProperty(res, 'writableEnded', { value: true, writable: true, configurable: true });
    return res;
  }) as any;

  // Also stub flushHeaders so writeSseHeaders doesn't throw
  res.flushHeaders = vi.fn() as any;

  return {
    res,
    getBody: () => Buffer.concat(chunks).toString('utf8'),
    statusCode: () => capturedStatusCode,
  };
}

function makeMockContext(overrides?: Record<string, unknown>) {
  const mockKernel = {
    assemblePrompt: vi.fn().mockResolvedValue('You are a helpful assistant.'),
  };
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const mockConversationStore = {
    create: vi.fn().mockResolvedValue({ id: 'mock-conv-id', title: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), preview: null, messageCount: 0 }),
    get: vi.fn().mockResolvedValue({ metadata: { id: 'mock-conv-id', title: null, messageCount: 0 }, messages: [] }),
    append: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
    generateTitle: vi.fn().mockResolvedValue(null),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    updatePreview: vi.fn().mockResolvedValue(undefined),
  };

  const services: Record<string, unknown> = {
    'kernel.instance': mockKernel,
    'kernel.authRouter': {},
    'kernel.providers.registry': {},
    'kernel.logger': mockLogger,
    'webui.conversations': mockConversationStore,
    ...overrides,
  };

  return {
    getService: vi.fn((id: string) => services[id] ?? null),
    logger: mockLogger,
    mockKernel,
    mockLogger,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createChatHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws if kernel.instance service is missing', () => {
    const ctx = {
      getService: vi.fn().mockReturnValue(null),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as any;
    expect(() => createChatHandler(ctx)).toThrow("webui: required service 'kernel.instance' not available");
  });

  it('throws if kernel.authRouter service is missing', () => {
    const services: Record<string, unknown> = {
      'kernel.instance': { assemblePrompt: vi.fn() },
      'kernel.authRouter': null,
    };
    const ctx = {
      getService: vi.fn((id: string) => services[id] ?? null),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as any;
    expect(() => createChatHandler(ctx)).toThrow("webui: required service 'kernel.authRouter' not available");
  });

  describe('handleChat', () => {
    it('returns 400 for invalid JSON body', async () => {
      const ctx = makeMockContext();
      const handler = createChatHandler(ctx as any);

      const req = createMockReq('POST', '/api/chat', '{not-valid-json}');
      const { res, statusCode } = createMockRes();

      await handler(req, res, { bearer: 'test-token' } as any);

      expect(statusCode()).toBe(400);
    });

    it('returns 400 when schema validation fails (empty message)', async () => {
      const ctx = makeMockContext();
      const handler = createChatHandler(ctx as any);

      const req = createMockReq('POST', '/api/chat', JSON.stringify({ message: '' }));
      const { res, statusCode, getBody } = createMockRes();

      await handler(req, res, { bearer: 'test-token' } as any);

      expect(statusCode()).toBe(400);
      const body = JSON.parse(getBody());
      expect(body.error).toBeTruthy();
    });

    it('returns 413 when body exceeds size limit', async () => {
      const ctx = makeMockContext();
      const handler = createChatHandler(ctx as any);

      // Build a body larger than 65536 bytes
      const hugePart = 'x'.repeat(70000);
      const req = createMockReq('POST', '/api/chat', JSON.stringify({ message: hugePart }));
      const { res, statusCode, getBody } = createMockRes();

      await handler(req, res, { bearer: 'test-token' } as any);

      expect(statusCode()).toBe(413);
      const body = JSON.parse(getBody());
      expect(body.error).toMatch(/64KB/);
    });

    it('streams text-delta and done events for a valid request', async () => {
      const ctx = makeMockContext();
      const handler = createChatHandler(ctx as any);

      mockComplete.mockImplementation(async (_input: any, callbacks: any) => {
        callbacks.onThoughts('Hello world');
        callbacks.onDone();
        return { text: 'Hello world' };
      });

      const req = createMockReq('POST', '/api/chat', JSON.stringify({ message: 'Hi' }));
      const { res, getBody } = createMockRes();

      await handler(req, res, { bearer: 'test-token' } as any);

      const body = getBody();
      expect(body).toContain('text-delta');
      expect(body).toContain('Hello world');
      expect(body).toContain('"done"');
    });

    it('reuses the same session history on second request with same sessionId', async () => {
      const ctx = makeMockContext();
      // Override the conversation store to return history on second call
      const mockStore = ctx.getService('webui.conversations') as any;
      let callCount = 0;
      mockStore.get.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { metadata: { id: '550e8400-e29b-41d4-a716-446655440000' }, messages: [] };
        }
        return {
          metadata: { id: '550e8400-e29b-41d4-a716-446655440000' },
          messages: [
            { ts: new Date().toISOString(), msg: { role: 'user', content: 'First' } },
            { ts: new Date().toISOString(), msg: { role: 'assistant', content: 'Response' } },
          ],
        };
      });

      const handler = createChatHandler(ctx as any);
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';

      let capturedMessages: any[] = [];
      mockComplete.mockImplementation(async (_input: any, callbacks: any) => {
        capturedMessages = _input.messages;
        callbacks.onDone();
        return { text: 'Response' };
      });

      // First request
      const req1 = createMockReq('POST', '/api/chat', JSON.stringify({ message: 'First', sessionId }));
      const { res: res1 } = createMockRes();
      await handler(req1, res1, { bearer: 'test-token' } as any);

      // Second request — should include prior turn in history
      const req2 = createMockReq('POST', '/api/chat', JSON.stringify({ message: 'Second', sessionId }));
      const { res: res2 } = createMockRes();
      await handler(req2, res2, { bearer: 'test-token' } as any);

      // The messages array should include the first user turn in history
      const userMessages = capturedMessages.filter((m: any) => m.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(2);
      expect(userMessages.some((m: any) => m.content === 'First')).toBe(true);
      expect(userMessages.some((m: any) => m.content === 'Second')).toBe(true);
    });

    it('emits error SSE event when LLM throws', async () => {
      const ctx = makeMockContext();
      const handler = createChatHandler(ctx as any);

      mockComplete.mockRejectedValue(new Error('LLM is down'));

      const req = createMockReq('POST', '/api/chat', JSON.stringify({ message: 'Hi' }));
      const { res, getBody } = createMockRes();

      await handler(req, res, { bearer: 'test-token' } as any);

      const body = getBody();
      expect(body).toContain('"error"');
      expect(body).toContain('LLM is down');
    });

    it('silently returns on AbortError (client disconnect)', async () => {
      const ctx = makeMockContext();
      const handler = createChatHandler(ctx as any);

      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      mockComplete.mockRejectedValue(abortErr);

      const req = createMockReq('POST', '/api/chat', JSON.stringify({ message: 'Hi' }));
      const { res, getBody } = createMockRes();

      await handler(req, res, { bearer: 'test-token' } as any);

      // Should NOT contain an error event
      const body = getBody();
      expect(body).not.toContain('"error"');
    });

    it('does not write text-delta when res is already ended', async () => {
      const ctx = makeMockContext();
      const handler = createChatHandler(ctx as any);

      mockComplete.mockImplementation(async (_input: any, callbacks: any) => {
        // Simulate client disconnecting before callback fires
        Object.defineProperty(_input.abortSignal, 'aborted', { value: true });
        callbacks.onThoughts('Should not appear');
        callbacks.onDone();
        return { text: 'x' };
      });

      const req = createMockReq('POST', '/api/chat', JSON.stringify({ message: 'Hi' }));
      const { res, getBody } = createMockRes();

      // Pre-end the response to simulate disconnect
      Object.defineProperty(res, 'writableEnded', { value: true, writable: true, configurable: true });

      await handler(req, res, { bearer: 'test-token' } as any);

      // text-delta should not appear since writableEnded was true
      const body = getBody();
      expect(body).not.toContain('text-delta');
    });
  });
});
