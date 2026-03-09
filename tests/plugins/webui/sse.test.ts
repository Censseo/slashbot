import { describe, it, expect, vi } from 'vitest';
import type { ServerResponse } from 'node:http';
import { writeEvent, writeRawEvent, SSE_HEADERS, startKeepalive } from '../../../src/plugins/webui/sse.js';
import type { StreamEvent } from '../../../src/plugins/webui/types.js';

function mockResponse(): ServerResponse {
  const chunks: string[] = [];
  return {
    write: vi.fn((data: string) => { chunks.push(data); return true; }),
    writableEnded: false,
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    end: vi.fn(),
    _chunks: chunks,
  } as unknown as ServerResponse;
}

describe('SSE helpers', () => {
  describe('SSE_HEADERS', () => {
    it('should have text/event-stream content type', () => {
      expect(SSE_HEADERS['content-type']).toBe('text/event-stream');
    });

    it('should have no-cache', () => {
      expect(SSE_HEADERS['cache-control']).toBe('no-cache');
    });

    it('should have keep-alive', () => {
      expect(SSE_HEADERS['connection']).toBe('keep-alive');
    });
  });

  describe('writeEvent', () => {
    it('should write SSE data line with JSON payload', () => {
      const res = mockResponse();
      const event: StreamEvent = { type: 'text-delta', payload: { text: 'Hello' } };
      writeEvent(res, event);
      expect(res.write).toHaveBeenCalledWith(
        'data: {"type":"text-delta","payload":{"text":"Hello"}}\n\n'
      );
    });

    it('should write done event with sessionId', () => {
      const res = mockResponse();
      const event: StreamEvent = { type: 'done', payload: { sessionId: 'web-123' } };
      writeEvent(res, event);
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"done"')
      );
    });
  });

  describe('writeRawEvent', () => {
    it('should write arbitrary JSON as SSE data', () => {
      const res = mockResponse();
      writeRawEvent(res, { ts: '2026-01-01', level: 'info', message: 'test' });
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
    });
  });

  describe('startKeepalive', () => {
    it('should return a cleanup function', () => {
      const res = mockResponse();
      const stop = startKeepalive(res, 100);
      expect(typeof stop).toBe('function');
      stop();
    });

    it('should write keepalive comments', async () => {
      const res = mockResponse();
      const stop = startKeepalive(res, 50);
      await new Promise((r) => setTimeout(r, 80));
      stop();
      expect(res.write).toHaveBeenCalledWith(':keepalive\n\n');
    });
  });
});
