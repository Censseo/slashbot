/**
 * Contract: NodeRedPlugin - Plugin Integration
 *
 * Design contract for how NodeRedPlugin integrates with the slashbot plugin system.
 * This is NOT implementation code.
 */

import type {
  Plugin,
  PluginMetadata,
  PluginContext,
  ActionContribution,
  PromptContribution,
  SidebarContribution,
} from '../../../src/plugins/types';

// --- Plugin Metadata ---

export const NODERED_PLUGIN_METADATA: PluginMetadata = {
  id: 'feature.nodered',
  name: 'NodeRED',
  version: '1.0.0',
  category: 'feature',
  description: 'Node-RED lifecycle management as a managed child process',
  // No plugin dependencies — this is a foundation feature
  // contextInject defaults to true (include in LLM context)
};

// --- Plugin Lifecycle Contract ---

/**
 * init(context):
 *   1. Create NodeRedManager service
 *   2. Bind to DI: context.container.bind(TYPES.NodeRedManager).toConstantValue(manager)
 *   3. Call manager.init() — loads config, checks Node.js, determines initial state
 *   4. If config.enabled && state !== 'unavailable':
 *      - Call manager.start() (non-blocking, returns immediately)
 *   5. Register action parsers (if any XML tags defined)
 *   6. Import and store command handlers
 *
 * destroy():
 *   1. Call manager.destroy() — stops Node-RED gracefully, clears timers
 */

// --- Sidebar Contribution Contract ---

/**
 * Dynamic sidebar label using Object.defineProperty getter.
 *
 * The label reads the current state from NodeRedManager
 * and returns one of:
 *   - "NR: Running"    (state === 'running')
 *   - "NR: Starting"   (state === 'starting')
 *   - "NR: Stopped"    (state === 'stopped')
 *   - "NR: Failed"     (state === 'failed')
 *   - "NR: Disabled"   (state === 'disabled')
 *   - "NR: Unavailable" (state === 'unavailable')
 *
 * getStatus() returns true only when state === 'running'.
 * This maps to green (true) vs gray (false) in the sidebar.
 */
export function createSidebarContribution(
  getState: () => string,
): SidebarContribution {
  const contribution: SidebarContribution = {
    id: 'nodered',
    label: 'NR: Stopped', // Default, overridden by getter
    order: 15, // Before heartbeat (20), wallet (30)
    getStatus: () => getState() === 'running',
  };

  // Dynamic label via property descriptor
  Object.defineProperty(contribution, 'label', {
    get: () => {
      const state = getState();
      const labels: Record<string, string> = {
        disabled: 'NR: Disabled',
        unavailable: 'NR: Unavailable',
        stopped: 'NR: Stopped',
        starting: 'NR: Starting',
        running: 'NR: Running',
        failed: 'NR: Failed',
      };
      return labels[state] || 'NR: Unknown';
    },
    enumerable: true,
    configurable: true,
  });

  return contribution;
}

// --- Prompt Contribution Contract ---

/**
 * Priority: 160 (domain-specific, between heartbeat 150-200)
 * Content: Instructions for the LLM about Node-RED management capabilities
 *
 * The prompt informs the LLM that:
 * - Node-RED is managed as a child process
 * - /nodered commands are available
 * - The LLM should NOT try to start/stop Node-RED via bash
 */

// --- Action Contributions ---

/**
 * No XML action tags for lifecycle management.
 * All lifecycle operations go through slash commands.
 * Future features (flow-management) will add action tags.
 *
 * getActionContributions() returns []
 */

// --- Tool Contributions ---

/**
 * No AI SDK tool contributions for lifecycle management.
 * Lifecycle commands are admin-only via slash commands.
 * Future features (flow CRUD) will add tool contributions.
 *
 * getToolContributions() returns []
 */

// --- File Structure ---

/**
 * src/plugins/nodered/
 *   index.ts              # NodeRedPlugin class
 *   types.ts              # NodeRedConfig, NodeRedState, etc.
 *   commands.ts           # /nodered command handler
 *   prompt.ts             # NODERED_PROMPT constant
 *   services/
 *     NodeRedManager.ts   # Core service (process, health, config, state)
 *     RingBuffer.ts       # Fixed-size circular log buffer
 *     settings.ts         # settings.js generator
 */
