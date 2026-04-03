---
name: ai-sdk-patterns
description: Vercel AI SDK integration patterns for LLM tool calling and streaming
---

# Vercel AI SDK Patterns

## Dependencies

- `ai` (v6+) — Core SDK with `generateText`, `CoreMessage` types
- `@ai-sdk/xai` — Grok provider (primary)
- `@ai-sdk/anthropic` — Claude provider
- `@ai-sdk/openai` — OpenAI provider
- `@ai-sdk/google` — Google provider

## Core Integration

### Streaming with `generateText()`

The project uses `generateText()` (not `streamText()`) with `maxSteps: 1` for single-iteration tool calling, managed by a custom agentic loop.

```typescript
import { generateText } from 'ai';

const result = await generateText({
  model,
  messages,
  temperature: ctx.config.temperature,
  maxOutputTokens: maxTokens,
  tools: toolsParam,       // AI SDK tool definitions
  maxSteps: 1,             // Single step — agentic loop handles iteration
  abortSignal: ctx.abortController.signal,
});
```

### Token Usage Tracking

```typescript
if (result.usage) {
  ctx.usage.promptTokens += result.usage.inputTokens || 0;
  ctx.usage.completionTokens += result.usage.outputTokens || 0;
}
```

## Tool Definition Pattern

Tools are defined as `ToolContribution` objects with Zod schemas, then bridged to AI SDK format via `ToolRegistry`.

### Defining a Tool Contribution

```typescript
import { z } from 'zod';
import type { ToolContribution } from '../types';

export function getMyToolContributions(): ToolContribution[] {
  return [
    {
      name: 'tool_name',
      description: 'What this tool does (LLM-visible)',
      parameters: z.object({
        param1: z.string().describe('Parameter description'),
        param2: z.number().optional().describe('Optional param'),
      }),
      toAction: (args) => ({
        type: 'my-action-type',
        param1: args.param1 as string,
        param2: args.param2 as number | undefined,
      }),
      controlFlow: 'continue',  // 'say' | 'end' | 'continue'
    },
  ];
}
```

### ToolRegistry Bridge

`ToolRegistry` converts `ToolContribution[]` → AI SDK `tools` parameter and maps tool call responses back to internal `Action` objects.

```typescript
// Registration (during plugin init)
toolRegistry.register(plugin.getToolContributions());

// Build AI SDK tools param
const toolsParam = toolRegistry.buildToolsParam();

// Map tool call back to action
const action = toolRegistry.mapToolCallToAction(toolName, args);
```

## Dual Execution Paths

1. **Native tool calling** — Model returns structured tool calls, mapped via `ToolRegistry.mapToolCallToAction()`
2. **XML fallback** — Model returns XML tags (`<bash>`, `<edit>`), parsed by action parsers

The agentic loop (`runAgenticLoop`) handles both paths transparently.

## Provider Registry

Models are resolved through a `ProviderRegistry` that maps model IDs to AI SDK provider instances:

```typescript
const model = ctx.providerRegistry.resolveModel(modelId, providerName);
```

## Message History

Messages stored as `{ role: 'user' | 'assistant' | 'system', content: string }` and converted to AI SDK `CoreMessage` format before each API call, including reconstruction of tool-call/tool-result message pairs.
