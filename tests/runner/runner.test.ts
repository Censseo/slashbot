import { describe, it, expect } from 'vitest';
import { SlashbotRunner } from '../../src/runner/runner.js';
import { PluginRegistry } from '../../src/runner/registry.js';
import { RUNNER_ERRORS } from '../../src/runner/types.js';
import type { RunnerPlugin, StepPayload, RunnerEvent } from '../../src/runner/types.js';

const basePayload: StepPayload = {
  stepType: 'claude-code',
  prompt: 'Write a hello world function',
  model: 'claude-opus-4-6',
  workspacePath: '/workspace',
  credentials: { CLAUDE_API_KEY: 'test-key' },
};

async function collectEvents(gen: AsyncGenerator<RunnerEvent>): Promise<RunnerEvent[]> {
  const events: RunnerEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

function makePlugin(events: RunnerEvent[], shouldThrow?: boolean): RunnerPlugin {
  return {
    stepTypes: ['claude-code'],
    async *execute(_payload: StepPayload): AsyncGenerator<RunnerEvent> {
      if (shouldThrow) throw new Error('plugin exploded');
      for (const e of events) yield e;
    },
  };
}

describe('SlashbotRunner', () => {
  it('success path: plugin yields output_chunk + step_complete in order', async () => {
    const registry = new PluginRegistry();
    const plugin = makePlugin([
      { type: 'output_chunk', content: 'hello' },
      { type: 'step_complete', result: 'done' },
    ]);
    registry.register('claude-code', plugin);
    const runner = new SlashbotRunner(registry);

    const events = await collectEvents(runner.executeStep(basePayload));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'output_chunk', content: 'hello' });
    expect(events[1]).toEqual({ type: 'step_complete', result: 'done' });
  });

  it('plugin throws → error event with PLUGIN_ERROR code; no throw to caller', async () => {
    const registry = new PluginRegistry();
    registry.register('claude-code', makePlugin([], true));
    const runner = new SlashbotRunner(registry);

    const events = await collectEvents(runner.executeStep(basePayload));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    if (events[0].type === 'error') {
      expect(events[0].code).toBe(RUNNER_ERRORS.PLUGIN_ERROR);
    }
  });

  it('no plugin for step type → error event with NO_PLUGIN code containing step type', async () => {
    const runner = new SlashbotRunner(new PluginRegistry());

    const events = await collectEvents(runner.executeStep({ ...basePayload, stepType: 'unknown-type' }));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    if (events[0].type === 'error') {
      expect(events[0].code).toBe(RUNNER_ERRORS.NO_PLUGIN);
      expect(events[0].message).toContain('unknown-type');
    }
  });

  it('default plugin fallback: no NO_PLUGIN error when default handles unknown type', async () => {
    const registry = new PluginRegistry();
    registry.registerDefault(makePlugin([{ type: 'step_complete', result: 'fallback done' }]));
    const runner = new SlashbotRunner(registry);

    const events = await collectEvents(runner.executeStep({ ...basePayload, stepType: 'any-type' }));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('step_complete');
  });

  it('invalid payload (missing prompt) → INVALID_PAYLOAD error immediately', async () => {
    const runner = new SlashbotRunner(new PluginRegistry());
    const bad = { ...basePayload, prompt: undefined } as unknown as StepPayload;

    const events = await collectEvents(runner.executeStep(bad));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
    if (events[0].type === 'error') {
      expect(events[0].code).toBe(RUNNER_ERRORS.INVALID_PAYLOAD);
    }
  });

  it('ask_user event flows through iterator without modification', async () => {
    const registry = new PluginRegistry();
    const askEvent: RunnerEvent = { type: 'ask_user', question: 'Confirm?', callbackId: 'cb-42' };
    registry.register('claude-code', makePlugin([askEvent, { type: 'step_complete', result: 'done' }]));
    const runner = new SlashbotRunner(registry);

    const events = await collectEvents(runner.executeStep(basePayload));
    expect(events[0]).toEqual(askEvent);
    expect(events[1].type).toBe('step_complete');
  });

  it('concurrency: 10 simultaneous executeStep calls produce isolated event streams', async () => {
    const registry = new PluginRegistry();
    // Each call yields a unique content string based on payload metadata index
    registry.register('claude-code', {
      stepTypes: ['claude-code'],
      async *execute(payload: StepPayload): AsyncGenerator<RunnerEvent> {
        const id = (payload.metadata as Record<string, unknown>)?.id ?? 'unknown';
        yield { type: 'output_chunk', content: `chunk-${id}` };
        yield { type: 'step_complete', result: `done-${id}` };
      },
    });
    const runner = new SlashbotRunner(registry);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        collectEvents(runner.executeStep({ ...basePayload, metadata: { id: i } }))
      )
    );

    results.forEach((events, i) => {
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'output_chunk', content: `chunk-${i}` });
      expect(events[1]).toEqual({ type: 'step_complete', result: `done-${i}` });
    });
  });
});
