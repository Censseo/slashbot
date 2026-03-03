/**
 * McpBridgeService
 *
 * Auto-discovers Node-RED flows that are flagged for MCP exposure and
 * registers them as AI tool contributions via PluginRegistrationContext.
 *
 * Eligibility rules (US1):
 *   - Flow has at least one HTTP-in node (populated as httpEndpoints by FlowManager)
 *   - AND either: metadata.mcp === true OR label starts with "mcp-" (case-insensitive)
 *
 * @see /specs/004-mcp-bridge/
 */

import { z } from 'zod';
import type { JsonValue, PluginRegistrationContext, StructuredLogger } from '../../../core/kernel/contracts.js';
import type { EventBus } from '@slashbot/core/kernel/event-bus.js';
import type { FlowInfo, ParamDescriptor } from '../flow-types.js';
import type { FlowManager } from './FlowManager.js';

/** Plugin ID used when registering MCP-bridge tools. */
const NODERED_PLUGIN_ID = 'slashbot.nodered';

/**
 * Runtime-only representation of a flow tool registered by McpBridgeService.
 * Not stored in flow-types.ts — this is bridge-internal metadata only.
 */
export interface FlowToolDefinition {
  flowId: string;
  toolId: string;
  label: string;
  description: string;
  endpointUrl: string;
  httpMethod: string;
  params: Record<string, ParamDescriptor>;
}

/**
 * Minimal interface for the FlowManager dependency.
 * Avoids a hard import of the full FlowManager class in tests.
 */
interface IFlowManager {
  listFlows(): Promise<FlowInfo[]>;
}

export class McpBridgeService {
  /** Keyed by flowId for O(1) lookup in handleFlowDeleted / handleFlowUpdated. */
  private readonly registeredTools: Map<string, FlowToolDefinition> = new Map();
  private readonly logger: StructuredLogger;
  private unsubscribeReady?: () => void;
  private unsubscribeUpdated?: () => void;
  private unsubscribeDeleted?: () => void;
  private unsubscribeCreated?: () => void;

  constructor(
    private readonly flowManager: IFlowManager,
    private readonly events: Pick<EventBus, 'subscribe' | 'publish'>,
    private readonly context: PluginRegistrationContext,
    private readonly port: number = 1880,
  ) {
    this.logger = context.logger;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public async init(): Promise<void> {
    this.unsubscribeReady = this.events.subscribe('nodered:ready', () => {
      this.teardownAll();
      void this.scanAndRegister();
    });

    this.unsubscribeUpdated = this.events.subscribe('flow:updated', (envelope: unknown) => {
      const e = envelope as Record<string, unknown> | undefined;
      const payload = (e?.payload ?? e) as Record<string, unknown> | undefined;
      const flow = payload?.flow as FlowInfo | undefined;
      if (flow) void this.handleFlowUpdated(flow);
    });

    this.unsubscribeDeleted = this.events.subscribe('flow:deleted', (envelope: unknown) => {
      const e = envelope as Record<string, unknown> | undefined;
      const payload = (e?.payload ?? e) as Record<string, unknown> | undefined;
      const flowId = payload?.flowId as string | undefined;
      if (flowId) void this.handleFlowDeleted(flowId);
    });

    this.unsubscribeCreated = this.events.subscribe('flow:created', (envelope: unknown) => {
      const e = envelope as Record<string, unknown> | undefined;
      const payload = (e?.payload ?? e) as Record<string, unknown> | undefined;
      const flow = payload?.flow as FlowInfo | undefined;
      if (flow) void this.handleFlowUpdated(flow);
    });
  }

  public dispose(): void {
    this.unsubscribeReady?.();
    this.unsubscribeUpdated?.();
    this.unsubscribeDeleted?.();
    this.unsubscribeCreated?.();
    this.unsubscribeReady = undefined;
    this.unsubscribeUpdated = undefined;
    this.unsubscribeDeleted = undefined;
    this.unsubscribeCreated = undefined;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Scan all flows and register eligible ones as AI tools. */
  public async scanAndRegister(): Promise<void> {
    let flows: FlowInfo[];
    try {
      flows = await this.flowManager.listFlows();
    } catch (err) {
      this.logger.error('failed to list flows during scan', { error: String(err) });
      return;
    }

    let registered = 0;
    for (const flow of flows) {
      if (this.isEligible(flow)) {
        this.registerFlowTool(flow);
        registered++;
      }
    }
    this.logger.info('scan complete', { total: flows.length, registered });
  }

  /** Returns the tool IDs of all currently registered MCP flow tools. */
  public getRegisteredToolIds(): string[] {
    return Array.from(this.registeredTools.values()).map(def => def.toolId);
  }

  /** Unregister all currently registered tools and clear internal state. */
  public teardownAll(): void {
    for (const def of this.registeredTools.values()) {
      this.context.unregisterTool(def.toolId);
    }
    this.registeredTools.clear();
  }

  /** Handle flow:deleted event — unregister tool if the flow was registered. */
  public handleFlowDeleted(flowId: string): void {
    const def = this.registeredTools.get(flowId);
    if (!def) return;
    this.context.unregisterTool(def.toolId);
    this.registeredTools.delete(flowId);
    this.events.publish('prompt:redraw', {});
  }

  /**
   * Handle flow:updated and flow:created events.
   * - Was registered, still eligible, changed → upsert (unregister old, register new)
   * - Was registered, no longer eligible → unregister and remove
   * - Was NOT registered, now eligible → register
   * - Was NOT registered, still not eligible → no-op
   */
  public async handleFlowUpdated(flow: FlowInfo): Promise<void> {
    const existing = this.registeredTools.get(flow.id);
    const eligible = this.isEligible(flow);

    if (existing && eligible) {
      // Check if anything relevant changed
      const ep = flow.httpEndpoints[0];
      const newEndpoint = ep ? `http://127.0.0.1:${this.port}${ep.path}` : '';
      const newHttpMethod = (ep?.method ?? 'get').toUpperCase();
      const changed =
        existing.endpointUrl !== newEndpoint ||
        existing.httpMethod !== newHttpMethod ||
        existing.label !== flow.label ||
        existing.description !== (flow.metadata.description || flow.label) ||
        JSON.stringify(existing.params) !== JSON.stringify(flow.metadata.params ?? {});

      if (changed) {
        // Upsert: unregister old, remove from map, register fresh
        this.context.unregisterTool(existing.toolId);
        this.registeredTools.delete(flow.id);
        this.registerFlowTool(flow);
      }
    } else if (existing && !eligible) {
      this.context.unregisterTool(existing.toolId);
      this.registeredTools.delete(flow.id);
    } else if (!existing && eligible) {
      this.registerFlowTool(flow);
    }
    // else: not registered, still not eligible → no-op
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Determines whether a flow is eligible for MCP tool registration.
   * A flow is eligible when it has at least one HTTP endpoint AND is either
   * flagged with mcp:true or has a label matching /^mcp-/i.
   */
  private isEligible(flow: FlowInfo): boolean {
    const hasHttpEndpoint = flow.httpEndpoints.length > 0;
    const isMcpFlagged = flow.metadata.mcp === true;
    const isMcpLabeled = /^mcp-/i.test(flow.label);

    if (isMcpFlagged && !hasHttpEndpoint) {
      this.logger.warn('flow has mcp:true but no HTTP-in node — skipping', {
        flowId: flow.id,
        label: flow.label,
      });
      return false;
    }

    return hasHttpEndpoint && (isMcpFlagged || isMcpLabeled);
  }

  /**
   * Converts a human-readable flow label into a stable tool ID slug.
   * Format: `nodered:<slug>` where slug is lowercase, hyphen-separated,
   * max 64 characters.
   */
  private slugifyLabel(label: string): string {
    let slug = label
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');

    if (slug.length > 64) {
      this.logger.warn('tool slug truncated to 64 chars', {
        original: slug,
        truncated: slug.slice(0, 64),
      });
      slug = slug.slice(0, 64);
    }

    return `nodered:${slug}`;
  }

  /**
   * Builds a Zod object schema from a flow's param descriptors.
   * Falls back to an empty schema when no params are defined.
   */
  private buildSchema(
    params: Record<string, ParamDescriptor> | undefined,
  ): z.ZodObject<z.ZodRawShape> {
    if (!params || Object.keys(params).length === 0) {
      return z.object({ input: z.string().optional() });
    }

    const shape: z.ZodRawShape = {};
    for (const [key, desc] of Object.entries(params)) {
      let field: z.ZodTypeAny;
      switch (desc.type) {
        case 'number':
          field = z.number();
          break;
        case 'boolean':
          field = z.coerce.boolean();
          break;
        default:
          field = z.string();
          break;
      }
      // .describe() must come before .optional() in Zod v4
      if (desc.description) {
        field = field.describe(desc.description);
      }
      if (!desc.required) {
        field = field.optional();
      }
      shape[key] = field;
    }

    return z.object(shape);
  }

  /**
   * Registers a single eligible flow as an AI tool contribution.
   * Duplicate tool IDs (same slugified label) are skipped with a warning.
   */
  private registerFlowTool(flow: FlowInfo): void {
    const toolId = this.slugifyLabel(flow.label);

    const isDuplicate = Array.from(this.registeredTools.values()).some(d => d.toolId === toolId);
    if (isDuplicate) {
      this.logger.warn('duplicate tool ID — skipping', { toolId, flowId: flow.id });
      return;
    }

    const ep = flow.httpEndpoints[0]!;
    if (/(:\/\/|@|\.\.)/.test(ep.path)) {
      this.logger.warn('suspicious endpoint path — skipping', { path: ep.path, flowId: flow.id });
      return;
    }
    const endpointUrl = `http://127.0.0.1:${this.port}${ep.path}`;
    const schema = this.buildSchema(flow.metadata.params);
    const timeoutMs = flow.metadata.timeout ?? 30_000;
    const httpMethod = (ep.method ?? 'get').toUpperCase();

    const toolDef: FlowToolDefinition = {
      flowId: flow.id,
      toolId,
      label: flow.label,
      description: flow.metadata.description || flow.label,
      endpointUrl,
      httpMethod,
      params: flow.metadata.params ?? {},
    };

    this.context.registerTool({
      id: toolId,
      title: flow.label,
      pluginId: NODERED_PLUGIN_ID,
      description:
        flow.metadata.description || `Invoke Node-RED flow: ${flow.label}`,
      parameters: schema,
      timeoutMs: flow.metadata.timeout,
      execute: (args: JsonValue, _context: import('../../../core/kernel/contracts.js').ToolCallContext) =>
        this.invokeFlow(toolDef, args as Record<string, unknown>, timeoutMs),
    });

    this.registeredTools.set(flow.id, toolDef);
    this.logger.info('registered MCP tool', {
      toolId,
      flowId: flow.id,
      label: flow.label,
    });
    this.events.publish('prompt:redraw', {});
  }

  /**
   * Invokes a Node-RED flow's HTTP endpoint and returns a structured ToolResult.
   * Supports POST (body) and GET (query params). Respects timeout via AbortSignal.
   */
  private async invokeFlow(
    toolDef: FlowToolDefinition,
    args: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<import('../../../core/kernel/contracts.js').ToolResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let url = toolDef.endpointUrl;
      let body: string | undefined;
      const headers: Record<string, string> = {};

      const method = toolDef.httpMethod.toUpperCase();
      if (method === 'GET') {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(args)) {
          if (v !== undefined && v !== null) params.set(k, String(v));
        }
        const qs = params.toString();
        if (qs) url = `${url}?${qs}`;
      } else {
        body = JSON.stringify(args);
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          ok: false,
          error: {
            code: `HTTP_${response.status}`,
            message: `HTTP ${response.status}: ${text || response.statusText}`,
          },
        };
      }

      // Attempt JSON parse; fall back to raw text
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          const output = await response.json();
          return { ok: true, output };
        } catch {
          const text = await response.text().catch(() => '');
          return { ok: true, output: text };
        }
      }

      const text = await response.text().catch(() => '');
      // Try JSON parse even without content-type header
      try {
        return { ok: true, output: JSON.parse(text) };
      } catch {
        return { ok: true, output: text };
      }
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      if (isAbort) {
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: `Flow invocation timed out after ${timeoutMs}ms` },
        };
      }
      return {
        ok: false,
        error: { code: 'INVOKE_ERROR', message: String(err) },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
