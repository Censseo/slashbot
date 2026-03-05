/**
 * Node-RED Plugin - Managed Node-RED runtime lifecycle + flow management
 *
 * Factory-based plugin for slashbot3 architecture.
 * Manages Node-RED process lifecycle, flow CRUD, and status indicators.
 *
 * @see /specs/001-nodered-lifecycle/plan.md
 * @see /specs/002-flow-management/plan.md
 */

import { z } from 'zod';
import type { JsonValue, SlashbotPlugin, StructuredLogger, IndicatorStatus } from '../../plugin-sdk/index.js';
import type { EventBus } from '@slashbot/core/kernel/event-bus.js';
import type { PathResolver } from '@slashbot/core/kernel/contracts.js';
import { NodeRedManager } from './services/NodeRedManager.js';
import { FlowManager } from './services/FlowManager.js';
import { McpBridgeService } from './services/McpBridgeService.js';
import { FlowChangePoller } from './services/FlowChangePoller.js';
import { NODERED_PROMPT } from './prompt.js';
import type { NodeRedState, FlowChangeEvent } from './types.js';
import type { FlowCreateInput, FlowUpdateInput } from './flow-types.js';

declare module '@slashbot/core/kernel/event-bus.js' {
  interface EventMap {
    'nodered:ready': { port: number };
    'nodered:stopped': Record<string, never>;
    'nodered:error': { error: string };
    'nodered:failed': { error: string };
    'nodered:state': { state: string };
    'nodered:setup-needed': Record<string, never>;
    'prompt:redraw': Record<string, never>;
    'flow:created': { flowId: string; label: string; metadata: Record<string, JsonValue> };
    'flow:updated': { flowId: string; label: string; metadata: Record<string, JsonValue> };
    'flow:deleted': { flowId: string; metadata: Record<string, JsonValue> };
    'flow:external-change': FlowChangeEvent;
  }
}

const PLUGIN_ID = 'slashbot.nodered';

const STATE_LABELS: Record<NodeRedState, string> = {
  disabled: 'NR: Disabled',
  unavailable: 'NR: Unavailable',
  stopped: 'NR: Stopped',
  'setup-needed': 'NR: Setup Needed',
  starting: 'NR: Starting',
  running: 'NR: Running',
  failed: 'NR: Failed',
};

function formatUptime(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function createNodeRedPlugin(): SlashbotPlugin {
  let manager: NodeRedManager;
  let flowManager: FlowManager;
  let mcpBridgeService: McpBridgeService;
  let flowChangePoller: FlowChangePoller;
  let updateStatus: (status: IndicatorStatus) => void;

  return {
    manifest: {
      id: PLUGIN_ID,
      name: 'Node-RED',
      version: '1.0.0',
      main: 'bundled',
      description: 'Managed Node-RED runtime with flow management',
    },
    setup: (context) => {
      const paths = context.getService<PathResolver>('kernel.paths');
      const homePath = paths?.home() ?? process.cwd();
      const events = context.getService<EventBus>('kernel.events')!;
      const logger = context.getService<StructuredLogger>('kernel.logger') ?? context.logger;

      // Create services
      manager = new NodeRedManager(events, homePath);
      flowManager = new FlowManager(manager, events, homePath);
      mcpBridgeService = new McpBridgeService(flowManager, events, context, manager.getConfig().port);
      flowChangePoller = new FlowChangePoller(flowManager, events);

      // Register services
      context.registerService({
        id: 'nodered.manager',
        pluginId: PLUGIN_ID,
        description: 'NodeRedManager lifecycle service',
        implementation: manager,
      });
      context.registerService({
        id: 'nodered.flowManager',
        pluginId: PLUGIN_ID,
        description: 'FlowManager CRUD service',
        implementation: flowManager,
      });
      context.registerService({
        id: 'nodered.mcpBridge',
        pluginId: PLUGIN_ID,
        description: 'Auto-registers MCP-flagged flows as AI tools',
        implementation: mcpBridgeService,
      });

      // Status indicator
      updateStatus = context.contributeStatusIndicator({
        id: 'indicator.nodered',
        pluginId: PLUGIN_ID,
        label: 'Node-RED',
        kind: 'service',
        priority: 25,
        statusEvent: 'nodered:state',
        showActivity: true,
        connectorName: 'nodered',
        getInitialStatus: () => 'off',
      });

      // Prompt
      context.contributePromptSection({
        id: 'nodered.docs',
        pluginId: PLUGIN_ID,
        priority: 160,
        content: NODERED_PROMPT,
      });

      // Dynamic context
      context.contributeContextProvider({
        id: 'nodered.context',
        pluginId: PLUGIN_ID,
        priority: 60,
        provide: () => {
          const state = manager.getState();
          if (state === 'disabled') return '';
          if (state === 'setup-needed') {
            return 'Node-RED is not installed. To install it, run the setup skill: invoke the `nodered-setup` skill using the skills tool or `/skill run nodered-setup`.';
          }
          const editorUrl = manager.getEditorUrl();
          if (editorUrl) {
            return `Node-RED is currently ${state}. Editor: ${editorUrl}`;
          }
          return `Node-RED is currently ${state}.`;
        },
      });

      // ── Tools ──────────────────────────────────────────────────────

      context.registerTool({
        id: 'nodered.status',
        title: 'NR Status',
        pluginId: PLUGIN_ID,
        description: 'Get Node-RED runtime status (state, PID, port, uptime, logs). Args: {}',
        parameters: z.object({}),
        execute: async () => {
          const status = manager.getStatus(20);
          return { ok: true, output: status as unknown as JsonValue };
        },
      });

      context.registerTool({
        id: 'nodered.start',
        title: 'NR Start',
        pluginId: PLUGIN_ID,
        description: 'Start the Node-RED runtime. Args: {}',
        parameters: z.object({}),
        execute: async () => {
          const result = await manager.start();
          return result.success
            ? { ok: true, output: result.message ?? 'Node-RED starting' }
            : { ok: false, error: { code: 'NR_START_ERROR', message: result.error ?? 'Failed to start' } };
        },
      });

      context.registerTool({
        id: 'nodered.stop',
        title: 'NR Stop',
        pluginId: PLUGIN_ID,
        description: 'Stop the Node-RED runtime. Args: {}',
        parameters: z.object({}),
        execute: async () => {
          try {
            await manager.stop();
            return { ok: true, output: 'Node-RED stopped' };
          } catch (err) {
            return { ok: false, error: { code: 'NR_STOP_ERROR', message: String(err) } };
          }
        },
      });

      context.registerTool({
        id: 'nodered.restart',
        title: 'NR Restart',
        pluginId: PLUGIN_ID,
        description: 'Restart the Node-RED runtime. Args: {}',
        parameters: z.object({}),
        execute: async () => {
          try {
            await manager.restart();
            return { ok: true, output: 'Node-RED restarting' };
          } catch (err) {
            return { ok: false, error: { code: 'NR_RESTART_ERROR', message: String(err) } };
          }
        },
      });

      context.registerTool({
        id: 'nodered.flow.list',
        title: 'List Flows',
        pluginId: PLUGIN_ID,
        description: 'List all Node-RED flows with metadata. Args: {}',
        parameters: z.object({}),
        execute: async () => {
          try {
            const flows = await flowManager.listFlows();
            return { ok: true, output: flows as unknown as JsonValue };
          } catch (err) {
            return { ok: false, error: { code: 'NR_FLOW_LIST_ERROR', message: String(err) } };
          }
        },
      });

      context.registerTool({
        id: 'nodered.flow.create',
        title: 'Create Flow',
        pluginId: PLUGIN_ID,
        description: 'Create a new Node-RED flow. Args: { label: string, nodes: array, configs?: array, metadata?: { creator?, description?, tags?, mcp? } }',
        parameters: z.object({
          label: z.string().describe('Flow tab label'),
          nodes: z.array(z.record(z.string(), z.unknown())).describe('Array of Node-RED node objects'),
          configs: z.array(z.record(z.string(), z.unknown())).optional().describe('Array of config node objects'),
          metadata: z.object({
            creator: z.string().optional(),
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
            mcp: z.boolean().optional(),
          }).optional().describe('Flow metadata'),
        }),
        execute: async (args) => {
          try {
            const input = args as unknown as FlowCreateInput;
            const result = await flowManager.createFlow(input);
            return { ok: true, output: result as unknown as JsonValue };
          } catch (err) {
            return { ok: false, error: { code: 'NR_FLOW_CREATE_ERROR', message: String(err) } };
          }
        },
      });

      context.registerTool({
        id: 'nodered.flow.update',
        title: 'Update Flow',
        pluginId: PLUGIN_ID,
        description: 'Update an existing Node-RED flow. Args: { flowId: string, label?: string, nodes?: array, configs?: array, metadata?: object }',
        parameters: z.object({
          flowId: z.string().describe('Flow ID to update'),
          label: z.string().optional(),
          nodes: z.array(z.record(z.string(), z.unknown())).optional(),
          configs: z.array(z.record(z.string(), z.unknown())).optional(),
          metadata: z.object({
            creator: z.string().optional(),
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
            mcp: z.boolean().optional(),
          }).optional(),
        }),
        execute: async (args) => {
          try {
            const { flowId, ...input } = args as unknown as { flowId: string } & FlowUpdateInput;
            const result = await flowManager.updateFlow(flowId, input);
            return { ok: true, output: result as unknown as JsonValue };
          } catch (err) {
            return { ok: false, error: { code: 'NR_FLOW_UPDATE_ERROR', message: String(err) } };
          }
        },
      });

      context.registerTool({
        id: 'nodered.flow.delete',
        title: 'Delete Flow',
        pluginId: PLUGIN_ID,
        description: 'Delete a Node-RED flow by ID. Args: { flowId: string }',
        parameters: z.object({
          flowId: z.string().describe('Flow ID to delete'),
        }),
        execute: async (args) => {
          try {
            const { flowId } = args as unknown as { flowId: string };
            await flowManager.deleteFlow(flowId);
            return { ok: true, output: `Flow ${flowId} deleted` };
          } catch (err) {
            return { ok: false, error: { code: 'NR_FLOW_DELETE_ERROR', message: String(err) } };
          }
        },
      });

      context.registerTool({
        id: 'nodered.flow.get',
        title: 'Get Flow',
        pluginId: PLUGIN_ID,
        description: 'Get details of a Node-RED flow by ID. Args: { flowId: string }',
        parameters: z.object({
          flowId: z.string().describe('Flow ID'),
        }),
        execute: async (args) => {
          try {
            const { flowId } = args as unknown as { flowId: string };
            const result = await flowManager.getFlow(flowId);
            if (!result) {
              return { ok: false, error: { code: 'NR_FLOW_NOT_FOUND', message: `Flow not found: ${flowId}` } };
            }
            return { ok: true, output: result as unknown as JsonValue };
          } catch (err) {
            return { ok: false, error: { code: 'NR_FLOW_GET_ERROR', message: String(err) } };
          }
        },
      });

      // ── Command ────────────────────────────────────────────────────

      context.registerCommand({
        id: 'nodered',
        pluginId: PLUGIN_ID,
        description: 'Manage Node-RED lifecycle and flows',
        subcommands: ['status', 'start', 'stop', 'restart', 'config', 'ui', 'flow'],
        execute: async (args, commandContext) => {
          const sub = args[0]?.toLowerCase() ?? 'status';
          const w = commandContext.stdout;

          if (sub === 'status' || sub === 's') {
            const status = manager.getStatus(20);
            w.write(`\nNode-RED Status\n`);
            w.write(`  State:      ${status.state}\n`);
            w.write(`  PID:        ${status.pid ?? 'N/A'}\n`);
            w.write(`  Port:       ${status.port ?? 'N/A'}\n`);
            w.write(`  Uptime:     ${formatUptime(status.uptime)}\n`);
            w.write(`  Restarts:   ${status.restartCount}\n`);
            if (status.recentLogs.length > 0) {
              w.write(`\n  Recent logs:\n`);
              for (const line of status.recentLogs) {
                w.write(`    ${line}\n`);
              }
            }
            return 0;
          }

          if (sub === 'start') {
            const result = await manager.start();
            if (result.success) {
              w.write(`Starting Node-RED on port ${manager.getConfig().port}...\n`);
            } else {
              commandContext.stderr.write(`${result.error ?? 'Failed to start Node-RED'}\n`);
              return 1;
            }
            return 0;
          }

          if (sub === 'stop') {
            const state = manager.getState();
            if (state === 'stopped' || state === 'disabled') {
              w.write('Node-RED is not running.\n');
              return 0;
            }
            await manager.stop();
            w.write('Node-RED stopped.\n');
            return 0;
          }

          if (sub === 'restart') {
            await manager.restart();
            w.write('Restarting Node-RED...\n');
            return 0;
          }

          if (sub === 'config') {
            const key = args[1];
            const value = args[2];
            const UPDATABLE_KEYS = ['port', 'healthCheckInterval', 'shutdownTimeout', 'maxRestartAttempts'] as const;

            if (!key) {
              const config = manager.getConfig();
              w.write(`\nNode-RED Configuration\n`);
              w.write(`  enabled:              ${config.enabled}\n`);
              w.write(`  port:                 ${config.port}\n`);
              w.write(`  healthCheckInterval:  ${config.healthCheckInterval}s\n`);
              w.write(`  shutdownTimeout:      ${config.shutdownTimeout}s\n`);
              w.write(`  maxRestartAttempts:   ${config.maxRestartAttempts}\n`);
              w.write(`  localhostOnly:        ${config.localhostOnly}\n`);
              w.write(`  userDir:              ${config.userDir}\n`);
              w.write(`  editor.username:      ${config.editorUsername ?? '(not set)'}\n`);
              w.write(`  editor.password:      ${config.editorPasswordHash ? '(configured)' : '(not set)'}\n\n`);
              return 0;
            }

            // Handle editor credential subkeys
            if (key === 'editor.username') {
              if (!value) {
                commandContext.stderr.write('Usage: /nodered config editor.username <user>\n');
                return 1;
              }
              if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                commandContext.stderr.write('Username must contain only alphanumeric characters, hyphens, and underscores.\n');
                return 1;
              }
              await manager.saveConfig({ editorUsername: value });
              w.write(`Editor username set to "${value}". Restart Node-RED to apply.\n`);
              return 0;
            }

            if (key === 'editor.password') {
              if (!value) {
                commandContext.stderr.write('Usage: /nodered config editor.password <pass>\n');
                return 1;
              }
              const hash = await Bun.password.hash(value, 'bcrypt');
              // Generate a static API token for internal Admin API access
              const tokenBytes = new Uint8Array(32);
              crypto.getRandomValues(tokenBytes);
              const apiToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
              await manager.saveConfig({ editorPasswordHash: hash, editorApiToken: apiToken });
              w.write('Editor password configured. Restart Node-RED to apply.\n');
              return 0;
            }

            if (!value) {
              commandContext.stderr.write('Usage: /nodered config <key> <value>\n');
              return 1;
            }

            if (!(UPDATABLE_KEYS as readonly string[]).includes(key)) {
              commandContext.stderr.write(`Unknown config key: ${key}. Supported: ${UPDATABLE_KEYS.join(', ')}, editor.username, editor.password\n`);
              return 1;
            }

            const numericValue = Number(value);
            if (isNaN(numericValue) || numericValue <= 0) {
              commandContext.stderr.write(`Invalid value for ${key}: must be a positive number\n`);
              return 1;
            }

            await manager.saveConfig({ [key]: numericValue });
            w.write(`Updated ${key} = ${numericValue}\n`);
            w.write('Note: restart Node-RED for changes to take effect\n');
            return 0;
          }

          if (sub === 'ui') {
            const editorState = manager.getEditorState();
            if (editorState === 'disabled') {
              const config = manager.getConfig();
              if (config.editorUsername && !config.editorPasswordHash) {
                w.write('Editor password is not configured. Use `/nodered config editor.password <pass>` to set it.\n');
              } else if (!config.editorUsername && config.editorPasswordHash) {
                w.write('Editor username is not configured. Use `/nodered config editor.username <user>` to set it.\n');
              } else {
                w.write('Editor authentication is not configured. Use `/nodered config editor.username <user>` and `/nodered config editor.password <pass>` to set credentials.\n');
              }
              return 0;
            }
            if (editorState === 'unavailable') {
              w.write('Node-RED is not running. Use `/nodered start` to start it.\n');
              return 0;
            }
            const url = manager.getEditorUrl();
            w.write(`Node-RED Editor: ${url}\n`);
            return 0;
          }

          if (sub === 'flow') {
            const flowAction = args[1]?.toLowerCase();

            if (!flowAction || flowAction === 'list') {
              try {
                const flows = await flowManager.listFlows();
                w.write(`\nNode-RED Flows\n\n`);
                if (flows.length === 0) {
                  w.write('  No flows deployed.\n');
                } else {
                  for (const f of flows) {
                    const endpoints = f.httpEndpoints.length > 0 ? ` | endpoints: ${f.httpEndpoints.map(e => `${e.method.toUpperCase()} ${e.path}`).join(', ')}` : '';
                    w.write(`  ${f.id} | ${f.label} | nodes=${f.nodeCount}${endpoints}\n`);
                  }
                }
                w.write('\n');
              } catch (err) {
                commandContext.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
                return 1;
              }
              return 0;
            }

            if (flowAction === 'info' && args[2]) {
              try {
                const info = await flowManager.getFlow(args[2]);
                if (!info) {
                  commandContext.stderr.write(`Flow not found: ${args[2]}\n`);
                  return 1;
                }
                w.write(`\nFlow: ${info.label}\n`);
                w.write(`  ID:          ${info.id}\n`);
                w.write(`  Nodes:       ${info.nodeCount}\n`);
                w.write(`  Endpoints:   ${info.httpEndpoints.length > 0 ? info.httpEndpoints.map(e => `${e.method.toUpperCase()} ${e.path}`).join(', ') : 'none'}\n`);
                w.write(`  Creator:     ${info.metadata.creator}\n`);
                w.write(`  Created:     ${info.metadata.createdAt || 'N/A'}\n`);
                w.write(`  Updated:     ${info.metadata.updatedAt || 'N/A'}\n`);
                w.write(`  Description: ${info.metadata.description || 'none'}\n`);
                w.write(`  Tags:        ${info.metadata.tags.length > 0 ? info.metadata.tags.join(', ') : 'none'}\n`);
                w.write(`  MCP:         ${info.metadata.mcp}\n\n`);
              } catch (err) {
                commandContext.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
                return 1;
              }
              return 0;
            }

            if (flowAction === 'delete' && args[2]) {
              try {
                await flowManager.deleteFlow(args[2]);
                w.write(`Deleted flow ${args[2]}\n`);
              } catch (err) {
                commandContext.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
                return 1;
              }
              return 0;
            }

            // Flow help
            w.write(`\nFlow Commands\n\n`);
            w.write(`  /nodered flow list          List all flows\n`);
            w.write(`  /nodered flow info <id>     Show flow details\n`);
            w.write(`  /nodered flow delete <id>   Delete a flow\n\n`);
            return 0;
          }

          // Help
          w.write(`\nNode-RED Commands\n\n`);
          w.write(`  /nodered status     Show status and recent logs\n`);
          w.write(`  /nodered start      Start Node-RED\n`);
          w.write(`  /nodered stop       Stop Node-RED\n`);
          w.write(`  /nodered restart    Restart Node-RED\n`);
          w.write(`  /nodered config     Show/update configuration\n`);
          w.write(`  /nodered ui         Open the Node-RED editor\n`);
          w.write(`  /nodered flow       Flow management\n\n`);
          return 0;
        },
      });

      // ── Gateway methods ──────────────────────────────────────────────

      context.registerGatewayMethod({
        id: 'nodered.status',
        pluginId: PLUGIN_ID,
        description: 'Get Node-RED runtime status (state, PID, port, uptime, logs)',
        handler: async () => {
          const status = manager.getStatus(20);
          return status as unknown as JsonValue;
        },
      });

      context.registerGatewayMethod({
        id: 'nodered.flow.list',
        pluginId: PLUGIN_ID,
        description: 'List all Node-RED flows with metadata',
        handler: async () => {
          const flows = await flowManager.listFlows();
          return flows as unknown as JsonValue;
        },
      });

      context.registerGatewayMethod({
        id: 'nodered.flow.get',
        pluginId: PLUGIN_ID,
        description: 'Get a Node-RED flow by ID. Params: { flowId: string }',
        handler: async (params) => {
          const obj = params as Record<string, unknown> | null;
          const flowId = typeof obj?.flowId === 'string' ? obj.flowId : undefined;
          if (!flowId) return { ok: false, error: 'missing flowId' } as unknown as JsonValue;
          const result = await flowManager.getFlow(flowId);
          if (!result) return { ok: false, error: `Flow not found: ${flowId}` } as unknown as JsonValue;
          return result as unknown as JsonValue;
        },
      });

      context.registerGatewayMethod({
        id: 'nodered.flow.create',
        pluginId: PLUGIN_ID,
        description: 'Create a Node-RED flow. Params: { label, nodes, configs?, metadata? }',
        handler: async (params) => {
          const input = params as unknown as FlowCreateInput;
          if (!input?.label || !input?.nodes) return { ok: false, error: 'missing label or nodes' } as unknown as JsonValue;
          const result = await flowManager.createFlow(input);
          return result as unknown as JsonValue;
        },
      });

      context.registerGatewayMethod({
        id: 'nodered.flow.update',
        pluginId: PLUGIN_ID,
        description: 'Update a Node-RED flow. Params: { flowId, label?, nodes?, configs?, metadata? }',
        handler: async (params) => {
          const { flowId, ...input } = params as unknown as { flowId: string } & FlowUpdateInput;
          if (!flowId) return { ok: false, error: 'missing flowId' } as unknown as JsonValue;
          const result = await flowManager.updateFlow(flowId, input);
          return result as unknown as JsonValue;
        },
      });

      context.registerGatewayMethod({
        id: 'nodered.flow.delete',
        pluginId: PLUGIN_ID,
        description: 'Delete a Node-RED flow. Params: { flowId: string }',
        handler: async (params) => {
          const obj = params as Record<string, unknown> | null;
          const flowId = typeof obj?.flowId === 'string' ? obj.flowId : undefined;
          if (!flowId) return { ok: false, error: 'missing flowId' } as unknown as JsonValue;
          await flowManager.deleteFlow(flowId);
          return { ok: true, deleted: flowId } as unknown as JsonValue;
        },
      });

      // ── Hooks ──────────────────────────────────────────────────────

      interface OnceJobScheduler {
        addOnceJob(name: string, runAtMs: number, prompt: string): Promise<unknown>;
      }

      context.registerHook({
        id: 'nodered.startup',
        pluginId: PLUGIN_ID,
        domain: 'kernel',
        event: 'startup',
        priority: 60,
        handler: async () => {
          await manager.init();
          try {
            await mcpBridgeService.init();
          } catch (err: unknown) {
            logger.warn('McpBridgeService initialization failed — MCP bridge disabled', {
              error: String(err),
            });
          }
          // Wire FlowChangePoller to lifecycle events
          events.subscribe('nodered:ready', () => { flowChangePoller.start(); });
          events.subscribe('nodered:stopped', () => { flowChangePoller.stop(); });

          const config = manager.getConfig();
          const state = manager.getState();
          if (config.enabled && state !== 'unavailable' && state !== 'disabled' && state !== 'setup-needed') {
            await manager.start();
          }
          if (state === 'setup-needed') {
            const automation = context.getService<OnceJobScheduler>('automation.service');
            if (automation) {
              await automation.addOnceJob(
                'nodered-setup-prompt',
                Date.now(),
                'Node-RED is not installed. Please run the `nodered-setup` skill now to install it.',
              );
            }
          }
          // T017: Wire crash-restart skill job when all retries are exhausted
          manager.onAllRetriesExhausted = async () => {
            const automation = context.getService<OnceJobScheduler>('automation.service');
            if (automation) {
              const crashRestartCount = manager.getCrashRestartCount();
              if (crashRestartCount <= 3) {
                const backoffMs = 1000 * Math.pow(2, crashRestartCount - 1);
                await automation.addOnceJob(
                  'nodered-crash-restart',
                  Date.now() + backoffMs,
                  'Node-RED has crashed and failed to restart automatically. Please run the `nodered-setup` skill to reinstall and restart it.',
                );
              }
            }
          };
          const runState = manager.getState();
          updateStatus(runState === 'running' ? 'connected' : runState === 'starting' ? 'busy' : 'off');
          logger.info('Node-RED plugin initialized', { state: runState });
        },
      });

      context.registerHook({
        id: 'nodered.shutdown',
        pluginId: PLUGIN_ID,
        domain: 'kernel',
        event: 'shutdown',
        priority: 60,
        handler: async () => {
          flowChangePoller.stop();
          mcpBridgeService.dispose();
          await manager.destroy();
        },
      });
    },
  };
}

export { createNodeRedPlugin as createPlugin };
