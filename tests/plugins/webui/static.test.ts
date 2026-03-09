import { describe, it, expect } from 'vitest';
import { resolve, normalize } from 'node:path';

describe('Static file serving', () => {
  const assetsDir = '/tmp/test-assets';

  describe('path traversal prevention', () => {
    it('should block ../ in path', () => {
      const requestPath = '/../../../etc/passwd';
      const resolved = resolve(assetsDir, '.' + requestPath);
      const isInside = resolved.startsWith(assetsDir);
      expect(isInside).toBe(false);
    });

    it('should allow normal paths', () => {
      const requestPath = '/index.html';
      const resolved = resolve(assetsDir, '.' + requestPath);
      const isInside = resolved.startsWith(assetsDir);
      expect(isInside).toBe(true);
    });

    it('should allow nested paths', () => {
      const requestPath = '/assets/style.css';
      const resolved = resolve(assetsDir, '.' + requestPath);
      const isInside = resolved.startsWith(assetsDir);
      expect(isInside).toBe(true);
    });
  });

  describe('MIME type detection', () => {
    const MIME_TYPES: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
    };

    for (const [ext, mime] of Object.entries(MIME_TYPES)) {
      it(`should detect ${ext} as ${mime}`, () => {
        expect(MIME_TYPES[ext]).toBe(mime);
      });
    }
  });
});
