import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '../../src/runner/registry.js';
import type { RunnerPlugin, StepPayload, RunnerEvent } from '../../src/runner/types.js';

function makeStubPlugin(stepTypes: string[]): RunnerPlugin {
  return {
    stepTypes,
    async *execute(_payload: StepPayload): AsyncGenerator<RunnerEvent> {
      yield { type: 'step_complete', result: 'stub done' };
    },
  };
}

describe('PluginRegistry', () => {
  it('register then getPlugin returns the registered plugin', () => {
    const registry = new PluginRegistry();
    const plugin = makeStubPlugin(['claude-code']);
    registry.register('claude-code', plugin);
    expect(registry.getPlugin('claude-code')).toBe(plugin);
  });

  it('register with duplicate step type overwrites (last-write-wins)', () => {
    const registry = new PluginRegistry();
    const first = makeStubPlugin(['claude-code']);
    const second = makeStubPlugin(['claude-code']);
    registry.register('claude-code', first);
    registry.register('claude-code', second);
    expect(registry.getPlugin('claude-code')).toBe(second);
  });

  it('getPlugin for unknown type with no default returns undefined', () => {
    const registry = new PluginRegistry();
    expect(registry.getPlugin('unknown-type')).toBeUndefined();
  });

  it('registerDefault sets fallback for unknown step types', () => {
    const registry = new PluginRegistry();
    const defaultPlugin = makeStubPlugin([]);
    registry.registerDefault(defaultPlugin);
    expect(registry.getPlugin('anything')).toBe(defaultPlugin);
  });

  it('registerDefault called twice overwrites the previous default', () => {
    const registry = new PluginRegistry();
    const first = makeStubPlugin([]);
    const second = makeStubPlugin([]);
    registry.registerDefault(first);
    registry.registerDefault(second);
    expect(registry.getPlugin('unknown')).toBe(second);
  });

  it('exact match takes precedence over default plugin', () => {
    const registry = new PluginRegistry();
    const exact = makeStubPlugin(['claude-code']);
    const fallback = makeStubPlugin([]);
    registry.register('claude-code', exact);
    registry.registerDefault(fallback);
    expect(registry.getPlugin('claude-code')).toBe(exact);
    expect(registry.getPlugin('other')).toBe(fallback);
  });
});
