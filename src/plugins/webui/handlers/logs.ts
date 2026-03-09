/**
 * @module plugins/webui/handlers/logs
 *
 * GET /api/logs handler — real-time log streaming via SSE.
 * Subscribes to KernelLogger and forwards log entries as SSE events.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginRegistrationContext, GatewayCallContext, StructuredLogger } from '../../../core/kernel/contracts.js';
import type { KernelLogger } from '../../../core/kernel/logger.js';
import { writeSseHeaders, writeRawEvent, startKeepalive } from '../sse.js';

export function createLogsHandler(context: PluginRegistrationContext) {
  const logger = context.getService<KernelLogger>('kernel.logger');
  if (!logger) throw new Error("webui: required service 'kernel.logger' not available");

  return async function handleLogs(_req: IncomingMessage, res: ServerResponse, _ctx: GatewayCallContext): Promise<void> {
    writeSseHeaders(res);
    const stopKeepalive = startKeepalive(res);

    const unsubscribe = logger.subscribe((entry) => {
      if (!res.writableEnded) {
        writeRawEvent(res, entry);
      }
    });

    // Clean up on client disconnect
    res.on('close', () => {
      unsubscribe();
      stopKeepalive();
    });
  };
}
