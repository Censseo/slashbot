import { describe, expect, test, vi } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';
import { Script, createContext } from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load sse-client.js in a CJS-like sandbox to get module.exports
function loadSseclient() {
  const filePath = path.resolve(__dirname, '../../frontend/public/js/sse-client.js');
  const code = readFileSync(filePath, 'utf8');
  const mod = { exports: {} as Record<string, unknown> };
  // Use a proxy fetch so that tests can replace globalThis.fetch and the sandbox picks it up
  const proxyFetch = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
  const ctx = createContext({ module: mod, exports: mod.exports, fetch: proxyFetch, AbortController, TextDecoder, setTimeout, clearTimeout, console });
  new Script(code).runInContext(ctx);
  return mod.exports;
}
const { streamChat, _processLine } = loadSseclient() as {
  streamChat: (...args: unknown[]) => unknown;
  _processLine: (...args: unknown[]) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Callbacks = {
  onTextDelta?: (text: string) => void;
  onToolCallStart?: (payload: unknown) => void;
  onToolCallResult?: (payload: unknown) => void;
  onDone?: (sessionId: string) => void;
  onError?: (message: string) => void;
  on401?: () => void;
};

function processLine(line: string, callbacks: Callbacks = {}) {
  _processLine(line, callbacks);
}

// Build a mock fetch that returns an SSE stream from an array of lines
function buildMockFetch(status: number, lines: string[]) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader() {
        const encoder = new TextEncoder();
        const chunks = lines.map((l) => encoder.encode(l + '\n'));
        let i = 0;
        return {
          read: vi.fn().mockImplementation(() => {
            if (i < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[i++] });
            }
            return Promise.resolve({ done: true, value: undefined });
          }),
        };
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Unit tests for _processLine (pure parsing, no fetch)
// ---------------------------------------------------------------------------

describe('_processLine — text-delta', () => {
  test('calls onTextDelta with delta string', () => {
    const onTextDelta = vi.fn();
    processLine('data: {"type":"text-delta","delta":"Hello"}', { onTextDelta });
    expect(onTextDelta).toHaveBeenCalledOnce();
    expect(onTextDelta).toHaveBeenCalledWith('Hello');
  });

  test('handles delta with special characters', () => {
    const onTextDelta = vi.fn();
    processLine('data: {"type":"text-delta","delta":"line1\\nline2"}', { onTextDelta });
    expect(onTextDelta).toHaveBeenCalledWith('line1\nline2');
  });
});

describe('_processLine — tool-call-start and tool-call-result', () => {
  test('calls onToolCallStart with normalized payload', () => {
    const onToolCallStart = vi.fn();
    const raw = { type: 'tool-call-start', toolCallId: 'tc1', toolName: 'bash', args: { cmd: 'ls' } };
    processLine(`data: ${JSON.stringify(raw)}`, { onToolCallStart });
    expect(onToolCallStart).toHaveBeenCalledOnce();
    expect(onToolCallStart).toHaveBeenCalledWith({ toolCallId: 'tc1', toolName: 'bash', args: { cmd: 'ls' } });
  });

  test('calls onToolCallResult with normalized payload', () => {
    const onToolCallResult = vi.fn();
    const raw = { type: 'tool-call-result', toolCallId: 'tc1', result: 'ok', isError: false };
    processLine(`data: ${JSON.stringify(raw)}`, { onToolCallResult });
    expect(onToolCallResult).toHaveBeenCalledOnce();
    expect(onToolCallResult).toHaveBeenCalledWith({ toolCallId: 'tc1', result: 'ok', isError: false });
  });
});

describe('_processLine — done event', () => {
  test('calls onDone with sessionId', () => {
    const onDone = vi.fn();
    processLine('data: {"type":"done","sessionId":"sess-abc"}', { onDone });
    expect(onDone).toHaveBeenCalledWith('sess-abc');
  });
});

describe('_processLine — comment / keepalive lines', () => {
  test('ignores ": ping" keepalive lines', () => {
    const onTextDelta = vi.fn();
    const onError = vi.fn();
    processLine(': ping', { onTextDelta, onError });
    expect(onTextDelta).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  test('ignores generic comment lines starting with ":"', () => {
    const onTextDelta = vi.fn();
    processLine(': keep-alive', { onTextDelta });
    expect(onTextDelta).not.toHaveBeenCalled();
  });

  test('ignores empty lines', () => {
    const onTextDelta = vi.fn();
    processLine('', { onTextDelta });
    expect(onTextDelta).not.toHaveBeenCalled();
  });
});

describe('_processLine — malformed JSON', () => {
  test('discards line with invalid JSON without throwing', () => {
    const onError = vi.fn();
    expect(() => {
      processLine('data: {not valid json}', { onError });
    }).not.toThrow();
    expect(onError).not.toHaveBeenCalled();
  });

  test('discards truncated JSON without throwing', () => {
    expect(() => {
      processLine('data: {"type":"text-delta","delta":"Hello"', {});
    }).not.toThrow();
  });
});

describe('_processLine — error event', () => {
  test('calls onError with the message from an error event', () => {
    const onError = vi.fn();
    processLine('data: {"type":"error","message":"quota exceeded"}', { onError });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('quota exceeded');
  });

  test('calls onError with fallback message when no message field', () => {
    const onError = vi.fn();
    processLine('data: {"type":"error"}', { onError });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('Server stream error');
  });
});

describe('_processLine — unknown event types', () => {
  test('ignores unknown event types silently', () => {
    const onError = vi.fn();
    processLine('data: {"type":"future-event","data":"x"}', { onError });
    expect(onError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Integration tests for streamChat (mocked fetch)
// ---------------------------------------------------------------------------

describe('streamChat — partial chunk buffering', () => {
  test('handles SSE event split across two reads', async () => {
    const onTextDelta = vi.fn();

    // Split the event across two chunks
    const encoder = new TextEncoder();
    const part1 = encoder.encode('data: {"type":"text-del');
    const part2 = encoder.encode('ta","delta":"Hi"}\n');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader() {
          let call = 0;
          const chunks = [part1, part2];
          return {
            read: vi.fn().mockImplementation(() => {
              if (call < chunks.length) {
                return Promise.resolve({ done: false, value: chunks[call++] });
              }
              return Promise.resolve({ done: true, value: undefined });
            }),
          };
        },
      },
    });

    // Temporarily replace global fetch
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      streamChat('/api/chat', 'token123', { message: 'hi' }, { onTextDelta });
      // Allow async operations to complete
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      globalThis.fetch = origFetch;
    }

    expect(onTextDelta).toHaveBeenCalledWith('Hi');
  });
});

describe('streamChat — HTTP error handling', () => {
  async function runStreamChat(status: number) {
    const onError = vi.fn();
    const on401 = vi.fn();

    const mockFetch = buildMockFetch(status, []);
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      streamChat('/api/chat', 'bad-token', {}, { onError, on401 });
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      globalThis.fetch = origFetch;
    }

    return { onError, on401 };
  }

  test('calls onError for HTTP 401', async () => {
    const { onError } = await runStreamChat(401);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toMatch(/401|Unauthorized/i);
  });

  test('calls on401 for HTTP 401', async () => {
    const onError = vi.fn();
    const on401 = vi.fn();

    const mockFetch = buildMockFetch(401, []);
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      streamChat('/api/chat', 'bad-token', {}, { onError, on401 });
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      globalThis.fetch = origFetch;
    }

    expect(on401).toHaveBeenCalledOnce();
  });

  test('calls onError for HTTP 500', async () => {
    const { onError } = await runStreamChat(500);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toMatch(/500|Server error/i);
  });
});

describe('streamChat — successful stream', () => {
  test('parses multiple events from a stream', async () => {
    const onTextDelta = vi.fn();
    const onDone = vi.fn();

    const lines = [
      ': ping',
      'data: {"type":"text-delta","delta":"Hello "}',
      'data: {"type":"text-delta","delta":"world"}',
      'data: {"type":"done","sessionId":"sess-xyz"}',
    ];

    const mockFetch = buildMockFetch(200, lines);
    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      streamChat('/api/chat', 'tok', { message: 'hi' }, { onTextDelta, onDone });
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      globalThis.fetch = origFetch;
    }

    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, 'Hello ');
    expect(onTextDelta).toHaveBeenNthCalledWith(2, 'world');
    expect(onDone).toHaveBeenCalledWith('sess-xyz');
  });
});
