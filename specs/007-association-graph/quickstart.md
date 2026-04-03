# Quickstart: Association Graph for Memory

## What This Feature Does

Adds a knowledge graph layer to slashbot's memory system. Concepts are automatically extracted from stored memories and linked in a graph. The bot can explore related concepts, find paths between ideas, and get richer search results through graph-based expansion.

## Key Files

| File | Purpose |
|------|---------|
| `src/plugins/services/association-graph.ts` | AssociationGraph service (NEW ~250 lines) |
| `src/plugins/memory/index.ts` | Memory plugin (EXTEND — add 3 tools + enhanced context) |
| `src/plugins/services/memory-store.ts` | MemoryStore (EXTEND — emit event, add expand param) |
| `~/.slashbot/graph.jsonl` | Graph persistence file |

## How It Works

1. **On upsert**: MemoryStore emits `memory:upserted` → AssociationGraph extracts concepts via LLM → merges into graph
2. **On search**: MemoryStore optionally expands queries via graph neighbors → merged results with source markers
3. **Tools**: `memory.associate` (manual link), `memory.related` (explore neighbors), `memory.path` (find connection)
4. **Context**: Graph concepts injected into system prompt based on conversation topic

## Architecture

```
MemoryStore ──emit──> EventBus ──subscribe──> AssociationGraph
                                                  ├── extractAndMerge() ──> LlmAdapter
                                                  ├── neighbors() ──> BFS
                                                  ├── shortestPath() ──> Dijkstra
                                                  └── flush() ──> graph.jsonl
```

## Running Tests

```bash
bun run test src/plugins/services/association-graph.test.ts
bun run test src/plugins/memory/
```
