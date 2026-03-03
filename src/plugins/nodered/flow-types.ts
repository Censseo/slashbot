/**
 * Flow Management Type Definitions
 *
 * Types for the FlowManager service: CRUD operations on Node-RED flows,
 * custom metadata storage, validation, and lifecycle events.
 *
 * @see /specs/002-flow-management/data-model.md
 */

// ---------------------------------------------------------------------------
// Node-RED API reference types (shapes returned by the Admin API)
// ---------------------------------------------------------------------------

/** Individual node within a Node-RED flow. */
export interface NodeRedNode {
  id: string;
  type: string;
  z?: string;
  name?: string;
  x?: number;
  y?: number;
  wires?: string[][];
  [key: string]: unknown;
}

/** Top-level flow (tab) as returned by GET /flows. */
export interface NodeRedFlow {
  id: string;
  type: 'tab';
  label: string;
  disabled?: boolean;
  info?: string;
}

// ---------------------------------------------------------------------------
// FlowMetadata — custom sidecar metadata stored in flow-metadata.json
// ---------------------------------------------------------------------------

/**
 * Describes a single parameter exposed by a flow's HTTP endpoint.
 * Used to generate a Zod schema for MCP tool invocation (FR-005).
 */
export interface ParamDescriptor {
  type: 'string' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
}

export interface FlowMetadata {
  flowId: string;
  creator: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  tags: string[];
  mcp: boolean;
  /** Optional parameter schema for MCP tool invocation (FR-005). */
  params?: Record<string, ParamDescriptor>;
  /** Optional timeout override in milliseconds for flow invocation (FR-006). */
  timeout?: number;
}

export interface FlowMetadataInput {
  creator: string;
  description: string;
  tags: string[];
  mcp: boolean;
  /** Optional parameter schema for MCP tool invocation (FR-005). */
  params?: Record<string, ParamDescriptor>;
  /** Optional timeout override in milliseconds for flow invocation (FR-006). */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// CRUD input types
// ---------------------------------------------------------------------------

export interface FlowCreateInput {
  label: string;
  nodes: NodeRedNode[];
  configs?: NodeRedNode[];
  metadata?: Partial<FlowMetadataInput>;
}

export interface FlowUpdateInput {
  label?: string;
  nodes?: NodeRedNode[];
  configs?: NodeRedNode[];
  metadata?: Partial<FlowMetadataInput>;
}

// ---------------------------------------------------------------------------
// Enriched output type
// ---------------------------------------------------------------------------

export interface FlowInfo {
  id: string;
  label: string;
  nodeCount: number;
  httpEndpoints: { path: string; method: string }[];
  metadata: FlowMetadata;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Lifecycle events
// ---------------------------------------------------------------------------

export type FlowEvent =
  | { type: 'flow:created'; flowId: string; label: string; metadata: FlowMetadata }
  | { type: 'flow:updated'; flowId: string; label: string; metadata: FlowMetadata }
  | { type: 'flow:deleted'; flowId: string; metadata: FlowMetadata };

// ---------------------------------------------------------------------------
// Metadata file schema
// ---------------------------------------------------------------------------

export interface FlowMetadataFile {
  version: 1;
  flows: Record<string, FlowMetadata>;
}
