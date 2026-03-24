/**
 * @module plugins/webui/handlers/memory-files
 *
 * Memory file CRUD handlers:
 * - GET /api/memory/files — list directory tree
 * - GET /api/memory/files/:path — read file
 * - PUT /api/memory/files/:path — replace file content
 * - DELETE /api/memory/files/:path — delete file
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import type { MemoryFileNode, MemoryFileContent } from '../types.js';
import { FileContentSchema } from '../types.js';
import { promises as fs } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { readBody } from './utils.js';

export function createMemoryFilesHandler(context: PluginRegistrationContext) {
  const workspaceRoot = context.getService<string>('kernel.workspaceRoot') ?? process.cwd();
  const memoryDir = join(workspaceRoot, '.slashbot', 'memory');

  /**
   * Validate that a resolved path stays within memoryDir.
   */
  function validatePath(relPath: string): { valid: true; fullPath: string } | { valid: false; error: string } {
    // relPath is already decoded by the route handler — do NOT decode again
    // (double-decode would allow %252e%252e to bypass the traversal check)
    const fullPath = resolve(memoryDir, relPath);
    const rel = relative(memoryDir, fullPath);
    if (rel.startsWith('..') || rel.includes('..')) {
      return { valid: false, error: 'Path outside memory directory' };
    }
    return { valid: true, fullPath };
  }

  /**
   * Recursively read directory into tree structure.
   */
  async function buildTree(dirPath: string, basePath: string, depth = 0, maxDepth = 5): Promise<MemoryFileNode[]> {
    if (depth > maxDepth) return [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: MemoryFileNode[] = [];

    const sorted = entries.sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (entry.isSymbolicLink()) continue; // Skip symlinks to prevent loops
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const children = await buildTree(join(dirPath, entry.name), entryPath, depth + 1, maxDepth);
        nodes.push({ name: entry.name, path: entryPath, type: 'directory', children });
      } else {
        nodes.push({ name: entry.name, path: entryPath, type: 'file' });
      }
    }

    return nodes;
  }

  // --- List handler ---
  async function handleList(_req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    try {
      await fs.mkdir(memoryDir, { recursive: true });
      const tree = await buildTree(memoryDir, '');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(tree));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to list files' }));
    }
  }

  // --- Read handler ---
  async function handleRead(req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext, filePath: string): Promise<void> {
    const check = validatePath(filePath);
    if (!check.valid) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: check.error }));
      return;
    }
    try {
      const stat = await fs.stat(check.fullPath);
      const content = await fs.readFile(check.fullPath, 'utf8');
      const result: MemoryFileContent = {
        path: filePath,
        content,
        lastModified: stat.mtime.toISOString(),
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
      } else {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read file' }));
      }
    }
  }

  // --- Write handler ---
  async function handleWrite(req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext, filePath: string): Promise<void> {
    const check = validatePath(filePath);
    if (!check.valid) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: check.error }));
      return;
    }

    const body = await readBody(req);
    const parsed = FileContentSchema.safeParse(body);
    if (!parsed.success) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: "Request body must contain 'content' string" }));
      return;
    }

    try {
      // Ensure parent directory exists
      await fs.mkdir(dirname(check.fullPath), { recursive: true });
      await fs.writeFile(check.fullPath, parsed.data.content, 'utf8');
      const stat = await fs.stat(check.fullPath);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ path: filePath, lastModified: stat.mtime.toISOString() }));
    } catch {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to write file' }));
    }
  }

  // --- Delete handler ---
  async function handleDelete(_req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext, filePath: string): Promise<void> {
    const check = validatePath(filePath);
    if (!check.valid) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: check.error }));
      return;
    }

    try {
      await fs.unlink(check.fullPath);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ deleted: filePath }));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
      } else {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to delete file' }));
      }
    }
  }

  return { handleList, handleRead, handleWrite, handleDelete };
}
