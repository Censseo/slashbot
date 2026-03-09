# Feature: Automatic Context Injection

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 03
**Priority**: P3
**Status**: Not Specified

## Summary

Automatically inject relevant graph concepts into the system prompt based on the current conversation topic. The `memory.context` provider is extended to detect the conversation subject, query the graph for related concepts, and include a concise "related concepts" section that primes the LLM with associative context.

## User Value

**Who benefits**: End-users who get more contextual responses without explicit searches
**What they gain**: The bot proactively "remembers" related topics and connections, making conversations feel more natural and informed
**Success metric**: The bot references relevant associated concepts without being explicitly asked in >50% of topical conversations

## Scope

### This Feature Includes
- Extend `memory.context` provider to include graph-based associations
- Topic detection from recent conversation messages (keyword extraction)
- Query graph for neighbors of detected topics (depth 1-2)
- Format as concise "Related concepts" section in system prompt
- Budget-aware: limit injected context to avoid bloating the prompt

### This Feature Does NOT Include
- Modifying the graph
- Changing the conversation flow or adding new tools
- Embedding-based topic detection (keyword-based is sufficient)

## Key Use Cases

### Use Case 1: Primed Context
**Actor**: System (automatic, on each LLM call)
**Goal**: Give the LLM associative awareness
**Flow**:
1. User talks about "plugin architecture"
2. Context provider extracts keywords from last 3-5 messages
3. Matches keywords to graph nodes: "plugin-system" found
4. Neighbors: InversifyJS, EventBus, Plugin SDK, Service Registry
5. Injected into prompt: `Related concepts: InversifyJS (DI framework), EventBus (core messaging), Plugin SDK (plugin API), Service Registry (service lookup)`
6. LLM naturally references these in its response

## Dependencies

### Requires
- Feature 01: Graph Store (for graph queries)
- Feature 02: Search Enrichment (reuses expansion patterns, optional)

### Enables
- Nothing — this is the final phase

## Technical Hints

### Implementation Notes

- Extend existing `memory.context` provider in `src/plugins/memory/index.ts`
- Keyword extraction: tokenize last N messages, match against graph node labels/IDs
- Limit: inject max 10 related concepts (one line each) to stay within ~200 tokens
- Only inject if graph has relevant matches (don't add empty sections)
- Consider caching: if conversation topic hasn't changed, reuse previous injection

## Open Questions

- How to detect "topic change" to refresh injected context?
- Should injected concepts include the relation type? (e.g., "InversifyJS (uses)" vs just "InversifyJS")
- Priority: inject high-weight connections first?

## Notes

- This is the most speculative feature — effectiveness depends on graph quality built by Features 01 and 02
- Start simple (keyword matching to node labels) and iterate
- May want to A/B test with/without injection to measure impact
