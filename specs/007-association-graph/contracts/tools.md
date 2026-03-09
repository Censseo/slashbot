# Tool Contracts: Association Graph

## memory.associate (NEW)

**Description**: Manually link two concepts with a named relationship. Auto-creates nodes if they don't exist.

**Parameters** (Zod):
```
z.object({
  from: z.string().describe('Source concept label'),
  to: z.string().describe('Target concept label'),
  rel: z.string().describe('Relationship type (e.g., uses, part_of, depends_on)'),
  fromType: z.string().optional().describe('Source node type (default: concept)'),
  toType: z.string().optional().describe('Target node type (default: concept)'),
})
```

**Returns**: `{ ok: true, output: { from, to, rel, weight, created } }`

## memory.related (NEW)

**Description**: Find concepts related to a given concept by traversing graph edges in both directions.

**Parameters** (Zod):
```
z.object({
  concept: z.string().describe('Concept label or ID to explore'),
  depth: z.number().min(1).max(3).optional().describe('Traversal depth (default: 1, max: 3)'),
  type: z.string().optional().describe('Filter results by node type'),
})
```

**Returns**: `{ ok: true, output: [{ id, label, type, rel, weight, direction }] }`

## memory.path (NEW)

**Description**: Find the shortest path between two concepts in the knowledge graph.

**Parameters** (Zod):
```
z.object({
  from: z.string().describe('Source concept label or ID'),
  to: z.string().describe('Target concept label or ID'),
})
```

**Returns**: `{ ok: true, output: { found: boolean, path: [{ node, rel?, direction? }] } }`

## memory.search (MODIFIED)

**Added parameter**: `expand: z.boolean().optional().describe('Expand via graph neighbors (default: true)')`

**Modified return**: MemoryHit now includes `source: "direct" | "graph"` field.

## Events (NEW)

| Event | Payload | Publisher | Subscriber |
|-------|---------|-----------|------------|
| `memory:upserted` | `{ text: string, tags?: string[], file?: string, path: string, line: number }` | MemoryStore (after upsert) | AssociationGraph (extraction trigger) |
