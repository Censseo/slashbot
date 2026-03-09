/**
 * @module plugins/webui/handlers/static
 *
 * Static file serving service with SPA fallback and path traversal guard.
 * Registered as 'webui.static' service for the gateway to call as fallback.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve, extname } from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { StaticFileHandler } from '../../../core/gateway/server.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain',
};

/**
 * Create a static file handler for the given assets directory.
 * Returns a function compatible with StaticFileHandler type.
 *
 * @param assetsDir - Absolute path to the static assets directory
 * @returns Handler that returns true if it served a file, false otherwise
 */
export function createStaticFileHandler(assetsDir: string): StaticFileHandler {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (!req.url || req.method !== 'GET') return false;

    // Strip query params
    const urlPath = req.url.split('?')[0];

    // Resolve path within assets dir
    const filePath = resolve(assetsDir, '.' + urlPath);

    // Path traversal guard
    if (!filePath.startsWith(assetsDir)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return true;
    }

    // Try to serve the exact file
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
        res.writeHead(200, { 'content-type': contentType });
        createReadStream(filePath).pipe(res);
        return true;
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }

    // Try index.html in the directory
    const indexPath = resolve(filePath, 'index.html');
    try {
      const indexStat = await stat(indexPath);
      if (indexStat.isFile()) {
        res.writeHead(200, { 'content-type': 'text/html' });
        createReadStream(indexPath).pipe(res);
        return true;
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }

    // SPA fallback: serve root index.html for non-API paths
    const spaIndex = resolve(assetsDir, 'index.html');
    try {
      await stat(spaIndex);
      res.writeHead(200, { 'content-type': 'text/html' });
      createReadStream(spaIndex).pipe(res);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }

    // No static file handler could serve this request
    return false;
  };
}
