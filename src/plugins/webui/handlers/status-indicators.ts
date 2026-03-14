/**
 * @module plugins/webui/handlers/status-indicators
 *
 * GET /api/status-indicators handler — returns status indicator entries as JSON array.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext } from '../../../core/kernel/contracts.js';
import type { StatusIndicatorRegistry } from '../../../core/kernel/registries.js';

export interface StatusIndicatorEntry {
  id: string;
  label: string;
  kind: 'connector' | 'service';
  status: string;
}

export function createStatusIndicatorsHandler(context: PluginRegistrationContext) {
  const registry = context.getService<StatusIndicatorRegistry>('kernel.statusIndicators.registry');
  if (!registry) throw new Error("webui: required service 'kernel.statusIndicators.registry' not available");

  return async function handleStatusIndicators(_req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    const indicators = registry.list();
    const entries: StatusIndicatorEntry[] = indicators.map((ind) => ({
      id: ind.id,
      label: ind.label,
      kind: ind.kind,
      status: registry.getStatus(ind.id),
    }));

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(entries));
  };
}
