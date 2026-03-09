/**
 * @module plugins/webui/handlers/plugins
 *
 * GET /api/plugins handler — returns plugin status as JSON array.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext, PluginDiagnostic } from '../../../core/kernel/contracts.js';
import type { PluginStatusEntry } from '../types.js';

export function createPluginsHandler(context: PluginRegistrationContext) {
  const getDiagnostics = context.getService<() => PluginDiagnostic[]>('kernel.diagnostics');
  if (!getDiagnostics) throw new Error("webui: required service 'kernel.diagnostics' not available");

  return async function handlePlugins(_req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    const diagnostics = getDiagnostics();
    const entries: PluginStatusEntry[] = diagnostics.map((d) => ({
      pluginId: d.pluginId,
      status: d.status,
      ...(d.reason ? { reason: d.reason } : {}),
    }));

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(entries));
  };
}
