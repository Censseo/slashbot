/**
 * @module plugins/webui/handlers/memory-timeline
 *
 * GET /api/memory/timeline handler — returns recent daily notes grouped by day.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import { TimelineQuerySchema } from '../types.js';
import type { TimelineDay, TimelineEntry } from '../types.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export function createMemoryTimelineHandler(context: PluginRegistrationContext) {
  const workspaceRoot = context.getService<string>('kernel.workspaceRoot') ?? process.cwd();
  const memoryDir = join(workspaceRoot, '.slashbot', 'memory');

  return async function handleMemoryTimeline(req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const rawDays = url.searchParams.get('days');
    const rawOffset = url.searchParams.get('offset');

    const parsed = TimelineQuerySchema.safeParse({
      days: rawDays ?? undefined,
      offset: rawOffset ?? undefined,
    });
    if (!parsed.success) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid query parameters' }));
      return;
    }
    const { days, offset } = parsed.data;

    try {
      const result: TimelineDay[] = [];
      const now = new Date();
      let found = 0;
      let skipped = 0;

      // Scan a generous window of calendar days to find enough with content
      for (let i = 0; i < (days + offset) * 30 && found < days; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        const yyyymmdd = `${yyyymm}${String(d.getDate()).padStart(2, '0')}`;
        const filePath = join(memoryDir, yyyymm, `${yyyymmdd}.md`);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        let content: string;
        try {
          content = await fs.readFile(filePath, 'utf8');
        } catch {
          continue;
        }

        // Found a day with content
        if (skipped < offset) {
          skipped++;
          continue;
        }

        const entries = parseDailyNoteEntries(content, dateStr);
        if (entries.length > 0) {
          result.push({ date: dateStr, entries });
          found++;
        }
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load timeline' }));
    }
  };
}

/**
 * Parse daily note markdown into timeline entries.
 * Expects lines like: `- [HH:MM] text` or `- [ISO date] text`
 */
function parseDailyNoteEntries(content: string, dateStr: string): TimelineEntry[] {
  const lines = content.split('\n');
  const entries: TimelineEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "- [HH:MM] text" or "- [ISO timestamp] text"
    const match = trimmed.match(/^-\s+\[([^\]]+)\]\s+(.+)$/);
    if (!match) continue;

    const timeOrStamp = match[1];
    const text = match[2];

    // Try to parse as time (HH:MM)
    let timestamp: string;
    if (/^\d{2}:\d{2}$/.test(timeOrStamp)) {
      timestamp = `${dateStr}T${timeOrStamp}:00Z`;
    } else {
      // Try ISO timestamp
      timestamp = timeOrStamp;
    }

    // Extract tags: [tags: foo, bar]
    const tags: string[] = [];
    const tagMatch = text.match(/\[tags?:\s*([^\]]+)\]/);
    if (tagMatch) {
      tags.push(...tagMatch[1].split(',').map(t => t.trim()).filter(Boolean));
    }

    const cleanText = text.replace(/\[tags?:\s*[^\]]+\]/, '').trim();
    const preview = cleanText.length > 200 ? cleanText.slice(0, 200) + '...' : cleanText;

    entries.push({ timestamp, tags, preview, content: cleanText });
  }

  return entries;
}
