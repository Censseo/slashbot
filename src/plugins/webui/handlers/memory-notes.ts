/**
 * @module plugins/webui/handlers/memory-notes
 *
 * POST /api/memory/notes handler — appends a quick note to today's daily note file.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import type { MemoryStore } from '../../services/memory-store.js';
import { QuickNoteSchema } from '../types.js';
import { readBody } from './utils.js';

export function createMemoryNotesHandler(context: PluginRegistrationContext) {
  const store = context.getService<MemoryStore>('memory.store');
  if (!store) throw new Error("webui: required service 'memory.store' not available");

  return async function handleMemoryNotes(req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    const body = await readBody(req);
    const parsed = QuickNoteSchema.safeParse(body);
    if (!parsed.success) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: "Request body must contain 'text' string" }));
      return;
    }

    try {
      const result = await store.appendToday(parsed.data.text);
      // Strip `memory/` prefix for consistency with file tree paths
      const path = typeof result?.path === 'string' ? result.path.replace(/^memory\//, '') : result?.path;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ path }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to add note' }));
    }
  };
}
