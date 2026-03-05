/**
 * MCP Bridge Contracts
 *
 * Internal type contracts for the MCP Bridge feature.
 * These types define the interfaces between components.
 */

import type { JsonValue } from '../../src/core/kernel/contracts.js';

// ── ParamDescriptor ─────────────────────────────────────────────────

/** Describes a single tool parameter from flow metadata */
export interface ParamDescriptor {
  type: 'string' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
}

// ── FlowToolDefinition ─────────────────────────────────────────────

/** Runtime tracking of a flow registered as a tool (not persisted) */
export interface FlowToolDefinition {
  flowId: string;
  toolId: string;
  label: string;
  description: string;
  endpointUrl: string;
  httpMethod: string;
  params: Record<string, ParamDescriptor>;
}

// ── McpBridgeService interface ──────────────────────────────────────

/** Public interface of the MCP Bridge service */
export interface IMcpBridgeService {
  /** Initialize: subscribe to events, perform initial scan if Node-RED is ready */
  init(): Promise<void>;

  /** Teardown: unregister all dynamic tools, unsubscribe from events */
  destroy(): Promise<void>;

  /** Scan all flows and register eligible ones as tools */
  scanAndRegister(): Promise<void>;

  /** Unregister all dynamic flow tools (nodered:* prefix) */
  teardownAll(): void;

  /** Get currently registered flow tool IDs */
  getRegisteredToolIds(): string[];
}

// ── Core extensions contract ────────────────────────────────────────

/**
 * Registry<T> extension:
 *   delete(id: string): void — removes item from registry
 *
 * PluginRegistrationContext extension:
 *   unregisterTool(id: string): void — removes tool from ToolRegistry
 *
 * Both additions mirror existing register() pattern.
 */
