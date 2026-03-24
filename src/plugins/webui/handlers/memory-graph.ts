/**
 * @module plugins/webui/handlers/memory-graph
 *
 * Graph data handlers:
 * - GET /api/memory/graph — full graph data (all nodes and edges)
 * - GET /api/memory/graph/neighbors/:id — neighbors of a specific node
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import { NeighborQuerySchema } from '../types.js';
import type { GraphNode, GraphEdge, NeighborResult, AssociationGraphLike } from '../types.js';

export function createMemoryGraphHandler(context: PluginRegistrationContext) {
  const graph = context.getService<AssociationGraphLike>('memory.graph');

  // --- Full graph handler ---
  async function handleGraph(_req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    if (!graph) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Association graph service not available' }));
      return;
    }

    try {
      const nodeIds = graph.getAllNodeIds();
      const nodes: GraphNode[] = [];
      for (const id of nodeIds) {
        const node = graph.getNode(id);
        if (node) nodes.push(node as GraphNode);
      }

      const edges: GraphEdge[] = [];
      if (graph.edges && graph.edges instanceof Map) {
        for (const edge of graph.edges.values()) {
          edges.push({
            from: edge.from,
            to: edge.to,
            rel: edge.rel,
            weight: edge.weight,
            created: edge.created,
          });
        }
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ nodes, edges }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load graph data' }));
    }
  }

  // --- Neighbors handler ---
  async function handleNeighbors(req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext, nodeId: string): Promise<void> {
    if (!graph) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Association graph service not available' }));
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const rawDepth = url.searchParams.get('depth');
    const parsed = NeighborQuerySchema.safeParse({ depth: rawDepth ?? undefined });
    const depth = parsed.success ? parsed.data.depth : 1;

    const node = graph.getNode(nodeId);
    if (!node) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Node not found' }));
      return;
    }

    try {
      const neighborResults = graph.neighbors(nodeId, depth);
      const neighbors: NeighborResult[] = neighborResults.map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        rel: n.rel,
        weight: n.weight,
        direction: n.direction as 'outgoing' | 'incoming',
      }));

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ node: node as GraphNode, neighbors }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to query neighbors' }));
    }
  }

  return { handleGraph, handleNeighbors };
}
