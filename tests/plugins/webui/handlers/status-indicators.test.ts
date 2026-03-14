/**
 * T003 — Unit tests for GET /api/status-indicators handler
 */
import { describe, it, expect, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { createStatusIndicatorsHandler } from '../../../../src/plugins/webui/handlers/status-indicators.js';

// ---------------------------------------------------------------------------
// Helpers (same pattern as other-handlers.test.ts)
// ---------------------------------------------------------------------------

function createMockReq(method: string, url: string): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.push(null);
  return req;
}

interface MockRes {
  res: ServerResponse;
  getBody: () => string;
  statusCode: () => number;
  getHeader: (name: string) => string | undefined;
}

function createMockRes(): MockRes {
  const socket = new Socket();
  const reqForRes = new IncomingMessage(socket);
  const res = new ServerResponse(reqForRes);

  const chunks: Buffer[] = [];
  let capturedStatusCode = 200;
  const capturedHeaders: Record<string, string> = {};

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

  res.end = ((chunk?: any) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    Object.defineProperty(res, 'writableEnded', { value: true, writable: true, configurable: true });
    return res;
  }) as any;

  return {
    res,
    getBody: () => Buffer.concat(chunks).toString('utf8'),
    statusCode: () => capturedStatusCode,
    getHeader: (name: string) => capturedHeaders[name.toLowerCase()],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createStatusIndicatorsHandler', () => {
  it('throws if kernel.statusIndicators.registry service is missing', () => {
    const ctx = { getService: vi.fn().mockReturnValue(null) } as any;
    expect(() => createStatusIndicatorsHandler(ctx)).toThrow(
      "webui: required service 'kernel.statusIndicators.registry' not available"
    );
  });

  it('returns 200 JSON array of status indicators', async () => {
    const indicators = [
      { id: 'connector.telegram', pluginId: 'connector.telegram', label: 'Telegram', kind: 'connector' as const },
      { id: 'service.nodered', pluginId: 'feature.nodered', label: 'Node-RED', kind: 'service' as const },
    ];
    const statuses = new Map([
      ['connector.telegram', 'connected'],
      ['service.nodered', 'running'],
    ]);
    const registry = {
      list: vi.fn().mockReturnValue(indicators),
      getStatus: vi.fn((id: string) => statuses.get(id) ?? 'off'),
    };
    const ctx = { getService: vi.fn().mockReturnValue(registry) } as any;

    const handler = createStatusIndicatorsHandler(ctx);
    const req = createMockReq('GET', '/api/status-indicators');
    const { res, statusCode, getBody, getHeader } = createMockRes();

    await handler(req, res, {} as any);

    expect(statusCode()).toBe(200);
    expect(getHeader('content-type')).toBe('application/json');

    const body = JSON.parse(getBody());
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ id: 'connector.telegram', label: 'Telegram', kind: 'connector', status: 'connected' });
    expect(body[1]).toEqual({ id: 'service.nodered', label: 'Node-RED', kind: 'service', status: 'running' });
  });

  it('handles empty registry', async () => {
    const registry = {
      list: vi.fn().mockReturnValue([]),
      getStatus: vi.fn().mockReturnValue('off'),
    };
    const ctx = { getService: vi.fn().mockReturnValue(registry) } as any;

    const handler = createStatusIndicatorsHandler(ctx);
    const req = createMockReq('GET', '/api/status-indicators');
    const { res, getBody } = createMockRes();

    await handler(req, res, {} as any);

    const body = JSON.parse(getBody());
    expect(body).toEqual([]);
  });
});
