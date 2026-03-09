/**
 * @module plugins/webui/sse
 *
 * Server-Sent Events (SSE) helper utilities for streaming responses.
 * Provides header setup, event writing, and keepalive support.
 */
import type { ServerResponse } from 'node:http';
import type { StreamEvent } from './types.js';

/** Standard SSE response headers. */
export const SSE_HEADERS: Record<string, string> = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  'connection': 'keep-alive',
};

/**
 * Write SSE headers to the response. Call once before any writeEvent calls.
 */
export function writeSseHeaders(res: ServerResponse, extraHeaders?: Record<string, string>): void {
  const headers = { ...SSE_HEADERS, ...extraHeaders };
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.writeHead(200);
  res.flushHeaders();
}

/**
 * Write a single SSE event to the response stream.
 *
 * Format: `data: <json>\n\n`
 */
export function writeEvent(res: ServerResponse, event: StreamEvent): boolean {
  const data = JSON.stringify(event);
  return res.write(`data: ${data}\n\n`);
}

/**
 * Write a raw JSON payload as an SSE data line.
 */
export function writeRawEvent(res: ServerResponse, payload: unknown): boolean {
  const data = JSON.stringify(payload);
  return res.write(`data: ${data}\n\n`);
}

/**
 * Start a keepalive interval that sends SSE comments to prevent connection timeout.
 * Returns a cleanup function to stop the interval.
 */
export function startKeepalive(res: ServerResponse, intervalMs = 15_000): () => void {
  const timer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(':keepalive\n\n');
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

