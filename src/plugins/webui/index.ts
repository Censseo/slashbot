/**
 * @module plugins/webui
 *
 * Web UI plugin providing HTTP API endpoints for a browser-based frontend:
 * - POST /api/chat — SSE streaming chat
 * - GET /api/plugins — Plugin status query
 * - GET /api/logs — SSE log streaming
 * - Static file serving (SPA fallback)
 * - webui.systemInfo RPC method
 *
 * @see {@link createWebuiPlugin} — Plugin factory function
 */
import { resolve } from 'node:path';
import type { SlashbotPlugin, PluginRegistrationContext, PathResolver } from '../../plugin-sdk/index.js';
import type {
  HealthStatus,
  PluginDiagnostic,
  JsonValue,
  GatewayCallContext,
  ChannelDefinition,
  ToolDefinition,
  CommandDefinition,
} from '../../core/kernel/contracts.js';
import { ConversationStore } from './services/conversation-store.js';
import type { Registry } from '../../core/kernel/registries.js';
import { createChatHandler } from './handlers/chat.js';
import { createPluginsHandler } from './handlers/plugins.js';
import { createLogsHandler } from './handlers/logs.js';
import { createStaticFileHandler } from './handlers/static.js';
import { createStatusIndicatorsHandler } from './handlers/status-indicators.js';
import { createListConversationsHandler, createGetConversationHandler, createDeleteConversationHandler } from './handlers/conversations.js';
import type { SystemInfo } from './types.js';

function createSystemInfoHandler(context: PluginRegistrationContext) {
  const getHealth = context.getService<() => HealthStatus>('kernel.health');
  const getDiagnostics = context.getService<() => PluginDiagnostic[]>('kernel.diagnostics');
  const getChannels = context.getService<() => ChannelDefinition[]>('kernel.channels');
  const getLoadedPlugins = context.getService<() => string[]>('kernel.loadedPlugins');
  const toolsRegistry = context.getService<Registry<ToolDefinition<JsonValue>>>('kernel.tools.registry');
  const commandsRegistry = context.getService<Registry<CommandDefinition>>('kernel.commands.registry');

  return async (_params: JsonValue, _ctx: GatewayCallContext): Promise<JsonValue> => {
    const diagnostics = getDiagnostics?.() ?? [];
    const channels = getChannels?.() ?? [];

    const mem = process.memoryUsage();
    const info: SystemInfo = {
      version: '0.1.0',
      uptime: Math.floor(process.uptime()),
      pluginsLoaded: diagnostics.filter((d) => d.status === 'loaded').length,
      pluginsFailed: diagnostics.filter((d) => d.status === 'failed').length,
      connectorsActive: channels.filter((c) => c.connector).length,
      commandCount: commandsRegistry?.list().length ?? 0,
      toolCount: toolsRegistry?.list().length ?? 0,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    };

    return info as unknown as JsonValue;
  };
}

export function createWebuiPlugin(): SlashbotPlugin {
  return {
    manifest: {
      id: 'slashbot.webui',
      name: 'Slashbot Web UI',
      version: '0.1.0',
      main: 'bundled',
      description: 'HTTP API endpoints for the web-based frontend (chat, plugins, logs, static files, RPC)',
    },
    setup: async (context) => {
      // Conversation store — persistent JSONL storage
      const paths = context.getService<PathResolver>('kernel.paths');
      const conversationsDir = paths
        ? paths.home('web-ui', 'conversations')
        : resolve(process.cwd(), '.slashbot', 'web-ui', 'conversations');
      const conversationStore = new ConversationStore(conversationsDir);
      await conversationStore.init();
      context.registerService({
        id: 'webui.conversations',
        pluginId: 'slashbot.webui',
        description: 'Persistent conversation storage (JSONL per conversation)',
        implementation: conversationStore,
      });

      // US1: POST /api/chat — SSE streaming chat
      const handleChat = createChatHandler(context);
      context.registerHttpRoute({
        method: 'POST',
        path: '/api/chat',
        pluginId: 'slashbot.webui',
        description: 'Streaming chat via SSE',
        handler: handleChat,
      });

      // US2: GET /api/plugins — Plugin status query
      const handlePlugins = createPluginsHandler(context);
      context.registerHttpRoute({
        method: 'GET',
        path: '/api/plugins',
        pluginId: 'slashbot.webui',
        description: 'Plugin status query',
        handler: handlePlugins,
      });

      // US3: GET /api/logs — SSE log streaming
      const handleLogs = createLogsHandler(context);
      context.registerHttpRoute({
        method: 'GET',
        path: '/api/logs',
        pluginId: 'slashbot.webui',
        description: 'Real-time log streaming via SSE',
        handler: handleLogs,
      });

      // US6: GET /api/status-indicators — Status indicator query
      const handleStatusIndicators = createStatusIndicatorsHandler(context);
      context.registerHttpRoute({
        method: 'GET',
        path: '/api/status-indicators',
        pluginId: 'slashbot.webui',
        description: 'Status indicator query',
        handler: handleStatusIndicators,
      });

      // Conversation CRUD endpoints
      const handleListConversations = createListConversationsHandler(context);
      context.registerHttpRoute({
        method: 'GET',
        path: '/api/conversations',
        pluginId: 'slashbot.webui',
        description: 'List all conversations',
        handler: handleListConversations,
      });

      const handleGetConversation = createGetConversationHandler(context);
      context.registerHttpRoute({
        method: 'GET',
        path: '/api/conversations/:id',
        pluginId: 'slashbot.webui',
        description: 'Get conversation by ID with full message history',
        handler: handleGetConversation,
      });

      const handleDeleteConversation = createDeleteConversationHandler(context);
      context.registerHttpRoute({
        method: 'DELETE',
        path: '/api/conversations/:id',
        pluginId: 'slashbot.webui',
        description: 'Delete conversation by ID',
        handler: handleDeleteConversation,
      });

      // US4: Static file serving — register as service for gateway fallback
      const workspaceRoot = context.getService<string>('kernel.workspaceRoot');
      const assetsDir = workspaceRoot ? resolve(workspaceRoot, 'frontend', 'public') : resolve(process.cwd(), 'frontend', 'public');
      const staticHandler = createStaticFileHandler(assetsDir);
      context.registerService({
        id: 'webui.static',
        pluginId: 'slashbot.webui',
        description: 'Static file serving handler for gateway fallback',
        implementation: staticHandler,
      });

      // US5: webui.systemInfo RPC method
      const handleSystemInfo = createSystemInfoHandler(context);
      context.registerGatewayMethod({
        id: 'webui.systemInfo',
        pluginId: 'slashbot.webui',
        description: 'Query system information (uptime, version, plugin count, connector count)',
        handler: handleSystemInfo,
      });
    },
  };
}

export { createWebuiPlugin as createPlugin };
