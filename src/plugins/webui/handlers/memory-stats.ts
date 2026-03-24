/**
 * @module plugins/webui/handlers/memory-stats
 *
 * GET /api/memory/stats handler — returns combined memory and graph statistics.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import type { MemoryStore, MemoryStats } from '../../services/memory-store.js';
import type { CombinedStats, GraphStats, DayCount, AssociationGraphLike } from '../types.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export function createMemoryStatsHandler(context: PluginRegistrationContext) {
  const store = context.getService<MemoryStore>('memory.store');
  if (!store) throw new Error("webui: required service 'memory.store' not available");

  const graph = context.getService<AssociationGraphLike>('memory.graph');
  const workspaceRoot = context.getService<string>('kernel.workspaceRoot') ?? process.cwd();
  const memoryDir = join(workspaceRoot, '.slashbot', 'memory');

  return async function handleMemoryStats(_req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    try {
      const memStats: MemoryStats = await store.stats();

      let graphStats: GraphStats | null = null;
      if (graph) {
        try {
          const nodeIds = graph.getAllNodeIds();
          const dist: Record<string, number> = {};
          for (const id of nodeIds) {
            const node = graph.getNode(id);
            const type = node?.type || 'concept';
            dist[type] = (dist[type] || 0) + 1;
          }
          // Count edges by inspecting graph internals or iterating
          let edgeCount = 0;
          if (graph.edges && graph.edges instanceof Map) {
            edgeCount = graph.edges.size;
          } else {
            // Fallback: count from node count approximation
            edgeCount = 0;
          }
          graphStats = {
            nodeCount: graph.nodeCount(),
            edgeCount,
            nodeTypeDistribution: dist,
          };
        } catch {
          graphStats = null;
        }
      }

      // Recent activity: count daily note files per day for last 7 days
      const recentActivity: DayCount[] = [];
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        const yyyymmdd = `${yyyymm}${String(d.getDate()).padStart(2, '0')}`;
        const filePath = join(memoryDir, yyyymm, `${yyyymmdd}.md`);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        try {
          const content = await fs.readFile(filePath, 'utf8');
          // Count entries (lines starting with "- [")
          const count = content.split('\n').filter(l => l.trim().startsWith('- [')).length;
          recentActivity.push({ date: dateStr, count });
        } catch {
          recentActivity.push({ date: dateStr, count: 0 });
        }
      }

      const result: CombinedStats = {
        memory: memStats,
        graph: graphStats,
        recentActivity,
      };

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}
