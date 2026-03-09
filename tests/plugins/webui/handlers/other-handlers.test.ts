/**
 * T031 — Integration tests for plugins, logs, and static handlers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPluginsHandler } from '../../../../src/plugins/webui/handlers/plugins.js';
import { createLogsHandler } from '../../../../src/plugins/webui/handlers/logs.js';
import { createStaticFileHandler } from '../../../../src/plugins/webui/handlers/static.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockReq(method: string, url: string): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.push(null); // no body
  return req;
}

interface MockRes {
  res: ServerResponse;
  getBody: () => string;
  statusCode: () => number;
  getHeader: (name: string) => string | undefined;
  closeListeners: Array<() => void>;
}

function createMockRes(): MockRes {
  const socket = new Socket();
  const reqForRes = new IncomingMessage(socket);
  const res = new ServerResponse(reqForRes);

  const chunks: Buffer[] = [];
  let capturedStatusCode = 200;
  const capturedHeaders: Record<string, string> = {};
  const closeListeners: Array<() => void> = [];

  const origWriteHead = res.writeHead.bind(res);
  (res as any).writeHead = (code: number, headers?: any) => {
    capturedStatusCode = code;
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        capturedHeaders[k.toLowerCase()] = String(v);
      }
    }
    return origWriteHead(code, headers);
  };

  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = ((name: string, value: any) => {
    capturedHeaders[name.toLowerCase()] = String(value);
    return origSetHeader(name, value);
  }) as any;

  res.write = ((chunk: any) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }) as any;

  res.end = ((chunk?: any) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    Object.defineProperty(res, 'writableEnded', { value: true, writable: true, configurable: true });
    return res;
  }) as any;

  res.flushHeaders = vi.fn() as any;

  // Capture 'close' event listeners for testing cleanup
  const origOn = res.on.bind(res);
  (res as any).on = (event: string, listener: (...args: any[]) => void) => {
    if (event === 'close') closeListeners.push(listener);
    return origOn(event, listener);
  };

  return {
    res,
    getBody: () => Buffer.concat(chunks).toString('utf8'),
    statusCode: () => capturedStatusCode,
    getHeader: (name: string) => capturedHeaders[name.toLowerCase()],
    closeListeners,
  };
}

// ---------------------------------------------------------------------------
// Plugins Handler Tests
// ---------------------------------------------------------------------------

describe('createPluginsHandler', () => {
  it('throws if kernel.diagnostics service is missing', () => {
    const ctx = { getService: vi.fn().mockReturnValue(null) } as any;
    expect(() => createPluginsHandler(ctx)).toThrow("webui: required service 'kernel.diagnostics' not available");
  });

  it('returns 200 JSON array of plugin statuses', async () => {
    const diagnostics = [
      { pluginId: 'core.bash', status: 'loaded' as const },
      { pluginId: 'core.wallet', status: 'failed' as const, reason: 'Missing key' },
    ];
    const ctx = {
      getService: vi.fn().mockReturnValue(() => diagnostics),
    } as any;

    const handler = createPluginsHandler(ctx);
    const req = createMockReq('GET', '/api/plugins');
    const { res, statusCode, getBody } = createMockRes();

    await handler(req, res, { bearer: 'test-token' } as any);

    expect(statusCode()).toBe(200);
    const body = JSON.parse(getBody());
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it('maps PluginDiagnostic fields to PluginStatusEntry correctly', async () => {
    const diagnostics = [
      { pluginId: 'core.bash', status: 'loaded' as const },
    ];
    const ctx = { getService: vi.fn().mockReturnValue(() => diagnostics) } as any;

    const handler = createPluginsHandler(ctx);
    const req = createMockReq('GET', '/api/plugins');
    const { res, getBody } = createMockRes();

    await handler(req, res, {} as any);

    const body = JSON.parse(getBody());
    expect(body[0].pluginId).toBe('core.bash');
    expect(body[0].status).toBe('loaded');
    expect(body[0].reason).toBeUndefined();
  });

  it('includes reason for failed plugins', async () => {
    const diagnostics = [
      { pluginId: 'feature.nodered', status: 'failed' as const, reason: 'Node-RED not found' },
    ];
    const ctx = { getService: vi.fn().mockReturnValue(() => diagnostics) } as any;

    const handler = createPluginsHandler(ctx);
    const req = createMockReq('GET', '/api/plugins');
    const { res, getBody } = createMockRes();

    await handler(req, res, {} as any);

    const body = JSON.parse(getBody());
    expect(body[0].reason).toBe('Node-RED not found');
  });

  it('omits reason key when not present', async () => {
    const diagnostics = [{ pluginId: 'core.bash', status: 'loaded' as const }];
    const ctx = { getService: vi.fn().mockReturnValue(() => diagnostics) } as any;

    const handler = createPluginsHandler(ctx);
    const req = createMockReq('GET', '/api/plugins');
    const { res, getBody } = createMockRes();

    await handler(req, res, {} as any);

    const body = JSON.parse(getBody());
    expect('reason' in body[0]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Logs Handler Tests
// ---------------------------------------------------------------------------

describe('createLogsHandler', () => {
  it('throws if kernel.logger service is missing', () => {
    const ctx = { getService: vi.fn().mockReturnValue(null) } as any;
    expect(() => createLogsHandler(ctx)).toThrow("webui: required service 'kernel.logger' not available");
  });

  it('writes SSE headers on connection', async () => {
    const unsubscribe = vi.fn();
    const mockLogger = { subscribe: vi.fn().mockReturnValue(unsubscribe) };
    const ctx = { getService: vi.fn().mockReturnValue(mockLogger) } as any;

    const handler = createLogsHandler(ctx);
    const req = createMockReq('GET', '/api/logs');
    const { res, getHeader } = createMockRes();

    await handler(req, res, {} as any);

    expect(getHeader('content-type')).toBe('text/event-stream');
  });

  it('forwards log entries as SSE events via subscribe callback', async () => {
    let capturedCallback: ((entry: unknown) => void) | null = null;
    const unsubscribe = vi.fn();
    const mockLogger = {
      subscribe: vi.fn((cb: (entry: unknown) => void) => {
        capturedCallback = cb;
        return unsubscribe;
      }),
    };
    const ctx = { getService: vi.fn().mockReturnValue(mockLogger) } as any;

    const handler = createLogsHandler(ctx);
    const req = createMockReq('GET', '/api/logs');
    const { res, getBody } = createMockRes();

    await handler(req, res, {} as any);

    // Simulate a log entry being published
    const entry = { ts: '2026-03-09T10:00:00Z', level: 'info', message: 'Gateway started' };
    capturedCallback!(entry);

    const body = getBody();
    expect(body).toContain('Gateway started');
    expect(body).toMatch(/^data: /m);
  });

  it('calls unsubscribe on close event', async () => {
    const unsubscribe = vi.fn();
    const mockLogger = { subscribe: vi.fn().mockReturnValue(unsubscribe) };
    const ctx = { getService: vi.fn().mockReturnValue(mockLogger) } as any;

    const handler = createLogsHandler(ctx);
    const req = createMockReq('GET', '/api/logs');
    const { res, closeListeners } = createMockRes();

    await handler(req, res, {} as any);

    // Trigger close
    for (const listener of closeListeners) listener();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not write to ended response', async () => {
    let capturedCallback: ((entry: unknown) => void) | null = null;
    const mockLogger = {
      subscribe: vi.fn((cb: (entry: unknown) => void) => {
        capturedCallback = cb;
        return vi.fn();
      }),
    };
    const ctx = { getService: vi.fn().mockReturnValue(mockLogger) } as any;

    const handler = createLogsHandler(ctx);
    const req = createMockReq('GET', '/api/logs');
    const { res, getBody } = createMockRes();

    await handler(req, res, {} as any);

    // End the response before emitting log
    Object.defineProperty(res, 'writableEnded', { value: true, writable: true, configurable: true });
    capturedCallback!({ ts: 'now', level: 'info', message: 'Should be ignored' });

    expect(getBody()).not.toContain('Should be ignored');
  });
});

// ---------------------------------------------------------------------------
// Static Handler Tests
// ---------------------------------------------------------------------------

describe('createStaticFileHandler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'webui-static-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns false for non-GET methods', async () => {
    const handler = createStaticFileHandler(tmpDir);
    const req = createMockReq('POST', '/index.html');
    const { res } = createMockRes();
    const result = await handler(req, res);
    expect(result).toBe(false);
  });

  it('returns false for missing file when no SPA index exists', async () => {
    const handler = createStaticFileHandler(tmpDir);
    const req = createMockReq('GET', '/missing.html');
    const { res } = createMockRes();
    const result = await handler(req, res);
    expect(result).toBe(false);
  });

  it('serves an existing file with correct content-type', async () => {
    await writeFile(join(tmpDir, 'style.css'), 'body { margin: 0; }');
    const handler = createStaticFileHandler(tmpDir);

    const req = createMockReq('GET', '/style.css');
    const { res, statusCode, getHeader } = createMockRes();

    // We need to collect piped data — override res.write before pipe
    const served = await handler(req, res);

    expect(served).toBe(true);
    expect(statusCode()).toBe(200);
    expect(getHeader('content-type')).toBe('text/css');
  });

  it('serves index.html for SPA fallback on unknown path', async () => {
    await writeFile(join(tmpDir, 'index.html'), '<!DOCTYPE html><html></html>');
    const handler = createStaticFileHandler(tmpDir);

    const req = createMockReq('GET', '/some/deep/route');
    const { res, statusCode, getHeader } = createMockRes();

    const served = await handler(req, res);

    expect(served).toBe(true);
    expect(statusCode()).toBe(200);
    expect(getHeader('content-type')).toBe('text/html');
  });

  it('returns 403 for path traversal attempts', async () => {
    const handler = createStaticFileHandler(tmpDir);

    const req = createMockReq('GET', '/../../../etc/passwd');
    const { res, statusCode, getBody } = createMockRes();

    const served = await handler(req, res);

    expect(served).toBe(true);
    expect(statusCode()).toBe(403);
    expect(getBody()).toBe('Forbidden');
  });

  it('serves directory index.html when path points to directory', async () => {
    await mkdir(join(tmpDir, 'subdir'));
    await writeFile(join(tmpDir, 'subdir', 'index.html'), '<h1>Subdir</h1>');
    const handler = createStaticFileHandler(tmpDir);

    const req = createMockReq('GET', '/subdir');
    const { res, statusCode, getHeader } = createMockRes();

    const served = await handler(req, res);

    expect(served).toBe(true);
    expect(statusCode()).toBe(200);
    expect(getHeader('content-type')).toBe('text/html');
  });

  it('strips query parameters when resolving file path', async () => {
    await writeFile(join(tmpDir, 'app.js'), 'console.log("hello")');
    const handler = createStaticFileHandler(tmpDir);

    const req = createMockReq('GET', '/app.js?v=123');
    const { res, statusCode, getHeader } = createMockRes();

    const served = await handler(req, res);

    expect(served).toBe(true);
    expect(statusCode()).toBe(200);
    expect(getHeader('content-type')).toBe('application/javascript');
  });
});
