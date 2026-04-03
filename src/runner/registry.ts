import type { RunnerPlugin, IPluginRegistry } from './types.js';

export class PluginRegistry implements IPluginRegistry {
  private plugins = new Map<string, RunnerPlugin>();
  private defaultPlugin: RunnerPlugin | undefined;

  register(stepType: string, plugin: RunnerPlugin): void {
    this.plugins.set(stepType, plugin);
  }

  registerDefault(plugin: RunnerPlugin): void {
    this.defaultPlugin = plugin;
  }

  getPlugin(stepType: string): RunnerPlugin | undefined {
    return this.plugins.get(stepType) ?? this.defaultPlugin;
  }
}
