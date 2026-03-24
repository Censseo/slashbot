/**
 * @module plugins/webui/handlers/memory-search
 *
 * GET /api/memory/search handler — unified search across memory store and association graph.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import type { MemoryStore } from '../../services/memory-store.js';
import { SearchQuerySchema } from '../types.js';
import type { GraphSearchHit, GraphEdge, GraphNode, AssociationGraphLike } from '../types.js';

export function createMemorySearchHandler(context: PluginRegistrationContext) {
  const store = context.getService<MemoryStore>('memory.store');
  if (!store) throw new Error("webui: required service 'memory.store' not available");

  const graph = context.getService<AssociationGraphLike>('memory.graph');

  return async function handleMemorySearch(req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const rawQ = url.searchParams.get('q');
    const rawLimit = url.searchParams.get('limit');

    const parsed = SearchQuerySchema.safeParse({
      q: rawQ,
      limit: rawLimit ?? undefined,
    });
    if (!parsed.success) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: "Query parameter 'q' is required" }));
      return;
    }
    const { q, limit } = parsed.data;

    try {
      // Memory search — strip `memory/` prefix so paths are relative to memory dir
      // (MemoryStore stores paths relative to ~/.slashbot/, but file API expects paths relative to ~/.slashbot/memory/)
      const memoryHits = (await store.search(q, limit)).map(hit => ({
        ...hit,
        path: hit.path.replace(/^memory\//, ''),
      }));

      // Graph search (label substring match)
      const graphHits: GraphSearchHit[] = [];
      if (graph) {
        try {
          const queryLower = q.toLowerCase();
          const nodeIds = graph.getAllNodeIds();
          for (const id of nodeIds) {
            if (graphHits.length >= limit) break;
            const node = graph.getNode(id);
            if (!node) continue;
            if (node.label.toLowerCase().includes(queryLower)) {
              const neighborResults = graph.neighbors(id, 1);
              const edges: GraphEdge[] = neighborResults.map(n => ({
                from: n.direction === 'outgoing' ? id : n.id,
                to: n.direction === 'outgoing' ? n.id : id,
                rel: n.rel,
                weight: n.weight,
                created: '',
              }));
              graphHits.push({
                node: node as GraphNode,
                matchedOn: 'label',
                edges,
              });
            }
          }
        } catch { /* graph search failed, return memory-only */ }
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ memory: memoryHits, graph: graphHits }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}
