# Feature: Search Enrichment via Graph

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 02
**Priority**: P2
**Status**: Not Specified

## Summary

Enrich `memory.search` results by expanding queries through graph neighbor traversal. When a search returns results, the graph identifies related concepts and runs secondary searches on neighbor labels, merging results with a lower weight to surface associatively related knowledge.

## User Value

**Who benefits**: The LLM agent and end-users getting richer answers
**What they gain**: Search results that include related concepts the user didn't explicitly mention — serendipitous discovery
**Success metric**: Search queries return 20-30% more relevant results compared to BM25 alone

## Scope

### This Feature Includes
- Hook into `MemoryStore.search()` to expand results via graph
- After BM25 results, extract top concept IDs from hits
- Query `AssociationGraph.neighbors()` for each top concept (depth 1)
- Run secondary BM25 searches on neighbor labels
- Merge and deduplicate results with weighted scoring (original > expanded)
- Optional flag to disable expansion (`expand: false`)

### This Feature Does NOT Include
- Modifying the graph itself
- Context provider (Feature 03)
- Re-ranking based on graph centrality

## Key Use Cases

### Use Case 1: Expanded Search
**Actor**: LLM agent
**Goal**: Find broadly related information
**Flow**:
1. `memory.search({ query: "authentication", expand: true })`
2. BM25 finds 3 hits about auth
3. Graph neighbors of "authentication": bcrypt, editor-password, Node-RED UI access
4. Secondary search on neighbors finds 2 more relevant hits
5. Returns 5 results, with expansion hits marked as `source: "graph"`

## Dependencies

### Requires
- Feature 01: Graph Store (for `neighbors()` method)

### Enables
- Feature 03: Context Injection (can reuse expansion logic)

## Technical Hints

### Implementation Notes

- Modify `MemoryStore.search()` to accept optional `AssociationGraph` reference
- Expansion budget: max 3 neighbor labels searched, max 3 extra results
- Expanded results scored at 50% of their BM25 score to avoid overwhelming direct matches
- Add `source: "direct" | "graph"` field to `MemoryHit`

## Open Questions

- Should expansion be on by default or opt-in? (suggest: on by default, opt-out with flag)
- How many neighbor hops? (suggest: 1 hop only to limit noise)

## Notes

- Keep expansion lightweight — this runs on every search call
- Consider caching neighbor lookups (graph is in-memory so already fast)
