/**
 * Flow Validator
 *
 * Validates Node-RED flow structure, wiring consistency, and installed nodes.
 * Pure validation functions for use by FlowManager service.
 *
 * @see /specs/002-flow-management/task-plans/T003-create-flow-validator.md
 */

import type { NodeRedNode, FlowValidationResult } from './flow-types';

/**
 * Built-in Node-RED node types that don't need to be checked via /nodes API.
 * These types are always available and don't appear in the installed nodes list.
 */
const BUILTIN_NODE_TYPES = new Set([
  'tab',
  'comment',
  'inject',
  'debug',
  'function',
  'http in',
  'http response',
]);

/**
 * Validates flow structure: tab node presence, required fields (id, type), z field consistency.
 *
 * @param nodes - Array of nodes to validate
 * @returns Validation result with any structural errors
 */
export function validateFlowStructure(nodes: NodeRedNode[]): FlowValidationResult {
  const errors: string[] = [];

  // Check for tab nodes
  const tabNodes = nodes.filter(n => n.type === 'tab');

  if (tabNodes.length === 0) {
    errors.push('Flow must contain at least one tab node');
    return { valid: false, errors };
  }

  if (tabNodes.length > 1) {
    errors.push('Flow must contain exactly one tab node');
    return { valid: false, errors };
  }

  // Collect tab IDs for z validation
  const tabIds = new Set(tabNodes.map(n => n.id));

  // Validate each node
  for (const node of nodes) {
    // Check required fields
    if (!node.id) {
      errors.push(`Node missing id`);
    }

    if (!node.type) {
      errors.push(`Node ${node.id || '(unknown)'} missing type`);
    }

    // Check z field for non-tab, non-comment nodes
    if (node.type !== 'tab' && node.type !== 'comment') {
      if (!node.z) {
        errors.push(`Node ${node.id} (type: ${node.type}): non-tab nodes must have z field`);
      } else if (!tabIds.has(node.z)) {
        errors.push(`Node ${node.id} (type: ${node.type}): references non-existent tab ${node.z}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates flow wiring: all wire references must point to existing nodes.
 *
 * @param nodes - Array of nodes to validate
 * @returns Validation result with any wiring errors
 */
export function validateFlowWiring(nodes: NodeRedNode[]): FlowValidationResult {
  const errors: string[] = [];

  // Collect all node IDs
  const nodeIds = new Set(nodes.map(n => n.id));

  // Check each node's wires
  for (const node of nodes) {
    // Skip tab nodes - their wiring is ignored
    if (node.type === 'tab') {
      continue;
    }

    // Skip if no wires or undefined
    if (!node.wires || node.wires.length === 0) {
      continue;
    }

    // Wires is array of arrays (one per output)
    for (const outputWires of node.wires) {
      if (!outputWires) continue;

      for (const targetId of outputWires) {
        if (!nodeIds.has(targetId)) {
          errors.push(`Node ${node.id} wires references non-existent node ${targetId}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that all custom node types are installed on the Node-RED instance.
 * Built-in types are always considered valid.
 *
 * @param nodes - Array of nodes to validate
 * @param port - Node-RED instance port (for API calls)
 * @returns Validation result with any missing node type errors
 */
export async function validateInstalledNodes(
  nodes: NodeRedNode[],
  port: number,
): Promise<FlowValidationResult> {
  const errors: string[] = [];

  // Collect unique node types, excluding built-ins
  const nodeTypes = new Set<string>();
  for (const node of nodes) {
    if (!BUILTIN_NODE_TYPES.has(node.type)) {
      nodeTypes.add(node.type);
    }
  }

  // Fetch installed nodes from Node-RED API (always call, even if no custom types)
  try {
    const response = await fetch(`http://localhost:${port}/nodes`);

    if (!response.ok) {
      errors.push(`Failed to fetch installed nodes: ${response.status} ${response.statusText}`);
      return { valid: false, errors };
    }

    const installedModules: Array<{ id: string; name: string; types: string[] }> = await response.json();

    // Collect all installed types
    const installedTypes = new Set<string>();
    for (const module of installedModules) {
      for (const type of module.types) {
        installedTypes.add(type);
      }
    }

    // Check each custom type (if any)
    for (const type of nodeTypes) {
      if (!installedTypes.has(type)) {
        errors.push(`Node type ${type} not installed`);
      }
    }
  } catch (error: unknown) {
    errors.push(`Failed to fetch installed nodes: ${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, errors };
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates entire flow: structure, wiring, and installed nodes.
 * Runs structure and wiring validation first (synchronous), then installed nodes (async).
 * Only calls fetch if both structure and wiring validations pass.
 *
 * @param nodes - Array of nodes to validate
 * @param port - Node-RED instance port (for API calls)
 * @returns Aggregated validation result from all stages
 */
export async function validateFlow(
  nodes: NodeRedNode[],
  port: number,
): Promise<FlowValidationResult> {
  const allErrors: string[] = [];

  // 1. Validate structure
  const structureResult = validateFlowStructure(nodes);
  allErrors.push(...structureResult.errors);

  // 2. Validate wiring (always run to aggregate errors)
  const wiringResult = validateFlowWiring(nodes);
  allErrors.push(...wiringResult.errors);

  // 3. Only validate installed nodes if structure and wiring both passed
  // (avoid unnecessary API call if basic validations failed)
  if (structureResult.valid && wiringResult.valid) {
    const installedResult = await validateInstalledNodes(nodes, port);
    allErrors.push(...installedResult.errors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
