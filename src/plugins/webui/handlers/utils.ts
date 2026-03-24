/**
 * @module plugins/webui/handlers/utils
 *
 * Shared utilities for webui HTTP handlers.
 */
import type { IncomingMessage } from 'node:http';

/**
 * Read the full request body and parse as JSON.
 * Returns null on parse failure.
 */
export async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}
