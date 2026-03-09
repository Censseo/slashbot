import { describe, it, expect } from 'vitest';
import type { PluginStatusEntry } from '../../../src/plugins/webui/types.js';

describe('Plugin status response format', () => {
  it('should have pluginId, status, and optional reason', () => {
    const entry: PluginStatusEntry = {
      pluginId: 'slashbot.core.ops',
      status: 'loaded',
    };
    expect(entry.pluginId).toBe('slashbot.core.ops');
    expect(entry.status).toBe('loaded');
    expect(entry.reason).toBeUndefined();
  });

  it('should include reason for failed plugins', () => {
    const entry: PluginStatusEntry = {
      pluginId: 'slashbot.nodered',
      status: 'failed',
      reason: 'Node-RED not installed',
    };
    expect(entry.status).toBe('failed');
    expect(entry.reason).toBe('Node-RED not installed');
  });

  it('should accept all valid status values', () => {
    const statuses: PluginStatusEntry['status'][] = ['loaded', 'disabled', 'failed', 'skipped'];
    for (const status of statuses) {
      const entry: PluginStatusEntry = { pluginId: 'test', status };
      expect(entry.status).toBe(status);
    }
  });

  it('should serialize to expected JSON format', () => {
    const entries: PluginStatusEntry[] = [
      { pluginId: 'slashbot.core.ops', status: 'loaded' },
      { pluginId: 'slashbot.nodered', status: 'failed', reason: 'Not installed' },
    ];
    const json = JSON.parse(JSON.stringify(entries));
    expect(json).toHaveLength(2);
    expect(json[0].pluginId).toBe('slashbot.core.ops');
    expect(json[1].reason).toBe('Not installed');
  });
});
