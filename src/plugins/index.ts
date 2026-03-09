/**
 * @module plugins
 *
 * Bundled plugin loader -- statically imports all built-in plugins.
 *
 * Plugins are imported at module level so the Bun compiler bundles them into
 * the compiled binary. A dynamic filesystem scan is no longer needed.
 *
 * @see {@link getBundledPlugins} -- Main entry point returning factories and discovered manifests
 * @see {@link BundledPluginFactory} -- Type alias for a zero-arg plugin factory function
 */
import type { SlashbotPlugin } from '../core/kernel/contracts.js';
import type { DiscoveredPlugin } from '../core/plugins/discovery.js';

import { createPlugin as createAgenticTools } from './agentic-tools/index.js';
import { createPlugin as createAgents } from './agents/index.js';
import { createPlugin as createAutomation } from './automation/index.js';
import { createPlugin as createCoreOps } from './core-ops/index.js';
import { createPlugin as createDiscord } from './discord/index.js';
import { createPlugin as createExplain } from './explain/index.js';
import { createPlugin as createHeartbeat } from './heartbeat/index.js';
import { createPlugin as createHooksDiscovery } from './hooks-discovery/index.js';
import { createPlugin as createMemory } from './memory/index.js';
import { createPlugin as createNodered } from './nodered/index.js';
import { createPlugin as createOrchestrator } from './orchestrator/index.js';
import { createPlugin as createProviderAuth } from './provider-auth/index.js';
import { createPlugin as createSkills } from './skills/index.js';
import { createPlugin as createSlack } from './slack/index.js';
import { createPlugin as createSystemPrompt } from './system-prompt/index.js';
import { createPlugin as createTelegram } from './telegram/index.js';
import { createPlugin as createTranscription } from './transcription/index.js';
import { createPlugin as createWallet } from './wallet/index.js';
import { createPlugin as createWebTools } from './web-tools/index.js';
import { createPlugin as createWebui } from './webui/index.js';
import { createPlugin as createWhatsApp } from './whatsapp/index.js';

/** Factory function that creates a SlashbotPlugin instance with no arguments. */
export type BundledPluginFactory = () => SlashbotPlugin;

interface BundledPlugins {
  /** Map of camelCase plugin names to their factory functions. */
  factories: Record<string, BundledPluginFactory>;
  /** Array of DiscoveredPlugin entries (manifest + source metadata). */
  discovered: DiscoveredPlugin[];
}

const STATIC_PLUGINS: Record<string, BundledPluginFactory> = {
  agenticTools: createAgenticTools,
  agents: createAgents,
  automation: createAutomation,
  coreOps: createCoreOps,
  discord: createDiscord,
  explain: createExplain,
  heartbeat: createHeartbeat,
  hooksDiscovery: createHooksDiscovery,
  memory: createMemory,
  nodered: createNodered,
  orchestrator: createOrchestrator,
  providerAuth: createProviderAuth,
  skills: createSkills,
  slack: createSlack,
  systemPrompt: createSystemPrompt,
  telegram: createTelegram,
  transcription: createTranscription,
  wallet: createWallet,
  webTools: createWebTools,
  webui: createWebui,
  whatsapp: createWhatsApp,
};

let cached: BundledPlugins | null = null;

/**
 * Return all bundled plugins via static imports.
 *
 * Every built-in plugin is imported at module level so it is included in
 * compiled Bun binaries. Results are cached after the first call.
 */
export async function getBundledPlugins(): Promise<BundledPlugins> {
  if (cached) return cached;

  const factories: Record<string, BundledPluginFactory> = {};
  const discovered: DiscoveredPlugin[] = [];

  for (const [key, factory] of Object.entries(STATIC_PLUGINS)) {
    try {
      const instance = factory();
      factories[key] = factory;
      discovered.push({
        manifest: instance.manifest,
        pluginPath: `bundled:${key}`,
        source: 'bundled' as const,
      });
    } catch {
      // Skip plugins that fail to instantiate
    }
  }

  cached = { factories, discovered };
  return cached;
}
