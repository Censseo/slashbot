import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodeRedNode, FlowValidationResult } from './flow-types';

// Mock fetch globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

// Import validator functions (will fail until T003 implemented - TDD)
import {
  validateFlowStructure,
  validateFlowWiring,
  validateInstalledNodes,
  validateFlow,
} from './flow-validator';

describe('Flow Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateFlowStructure', () => {
    it('passes with tab and nodes', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', name: 'Inject', wires: [] },
        { id: 'node2', type: 'debug', z: 'tab1', name: 'Debug', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails with no tab node', () => {
      const nodes: NodeRedNode[] = [
        { id: 'node1', type: 'inject', z: 'tab1', name: 'Inject', wires: [] },
        { id: 'node2', type: 'debug', z: 'tab1', name: 'Debug', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Flow must contain at least one tab node');
    });

    it('fails with multiple tab nodes', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Flow 1' },
        { id: 'tab2', type: 'tab', name: 'Flow 2' },
        { id: 'node1', type: 'inject', z: 'tab1', name: 'Inject', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Flow must contain exactly one tab node');
    });

    it('fails when node missing id', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { type: 'inject', z: 'tab1', name: 'Inject', wires: [] } as unknown as NodeRedNode,
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing id'))).toBe(true);
    });

    it('fails when node missing type', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', z: 'tab1', name: 'Inject', wires: [] } as unknown as NodeRedNode,
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing type'))).toBe(true);
    });

    it('fails when non-tab node missing z field', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', name: 'Inject', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-tab nodes must have z field'))).toBe(true);
    });

    it('passes when tab node has no z field', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', name: 'Inject', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes when comment node has no z field', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'comment1', type: 'comment', name: 'A comment' },
        { id: 'node1', type: 'inject', z: 'tab1', name: 'Inject', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when node z references non-existent tab', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'nonexistent', name: 'Inject', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('references non-existent tab'))).toBe(true);
    });

    it('accumulates multiple errors', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { type: 'inject', z: 'tab1', wires: [] } as unknown as NodeRedNode, // missing id
        { id: 'node2', z: 'tab1', wires: [] } as unknown as NodeRedNode, // missing type
        { id: 'node3', type: 'debug', z: 'wrongtab', wires: [] }, // wrong tab
      ];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('passes with empty nodes array', () => {
      const nodes: NodeRedNode[] = [];

      const result: FlowValidationResult = validateFlowStructure(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Flow must contain at least one tab node');
    });
  });

  describe('validateFlowWiring', () => {
    it('passes with valid wiring', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [['node2']] },
        { id: 'node2', type: 'debug', z: 'tab1', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails with dangling wire reference', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [['nonexistent']] },
        { id: 'node2', type: 'debug', z: 'tab1', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('references non-existent node'))).toBe(true);
    });

    it('passes with empty wires array', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes with undefined wires', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1' },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes with multiple outputs (wires is array of arrays)', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'switch', z: 'tab1', wires: [['node2'], ['node3']] },
        { id: 'node2', type: 'debug', z: 'tab1', wires: [] },
        { id: 'node3', type: 'debug', z: 'tab1', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes with multiple wires from single output', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [['node2', 'node3']] },
        { id: 'node2', type: 'debug', z: 'tab1', wires: [] },
        { id: 'node3', type: 'debug', z: 'tab1', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails with multiple dangling references', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [['bad1', 'bad2']] },
        { id: 'node2', type: 'debug', z: 'tab1', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('passes with self-referencing wires (loops)', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'function', z: 'tab1', wires: [['node1']] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('ignores tab nodes wiring', () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow', wires: [['invalid']] as any },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
      ];

      const result: FlowValidationResult = validateFlowWiring(nodes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateInstalledNodes', () => {
    it('passes when all node types are installed', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
        { id: 'node2', type: 'custom-node', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'custom-node', name: 'custom-node', types: ['custom-node'] },
        ],
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:1880/nodes');
    });

    it('passes when all nodes are built-in types', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
        { id: 'node2', type: 'debug', z: 'tab1', wires: [] },
        { id: 'node3', type: 'function', z: 'tab1', wires: [] },
        { id: 'node4', type: 'comment', z: 'tab1' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when custom node is not installed', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
        { id: 'node2', type: 'missing-node', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing-node') && e.includes('not installed'))).toBe(true);
    });

    it('fails when multiple custom nodes are not installed', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'missing1', z: 'tab1', wires: [] },
        { id: 'node2', type: 'missing2', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('fails when fetch returns error', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to fetch'))).toBe(true);
    });

    it('fails when fetch throws error', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
      ];

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Network error'))).toBe(true);
    });

    it('uses correct port in fetch URL', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await validateInstalledNodes(nodes, 9999);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:9999/nodes');
    });

    it('ignores tab and comment types in validation', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'comment1', type: 'comment', z: 'tab1' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('handles http in and http response built-in types', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'http in', z: 'tab1', wires: [] },
        { id: 'node2', type: 'http response', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deduplicates node types before checking', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'custom', z: 'tab1', wires: [] },
        { id: 'node2', type: 'custom', z: 'tab1', wires: [] },
        { id: 'node3', type: 'custom', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'custom', name: 'custom', types: ['custom'] },
        ],
      });

      const result: FlowValidationResult = await validateInstalledNodes(nodes, 1880);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateFlow', () => {
    it('passes with fully valid flow', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [['node2']] },
        { id: 'node2', type: 'debug', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails early on structure errors', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] }, // No tab
      ];

      // Should not call fetch if structure fails
      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tab node'))).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('aggregates errors from structure validation', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { type: 'inject', z: 'tab1', wires: [] } as unknown as NodeRedNode, // missing id
        { id: 'node2', z: 'tab1', wires: [] } as unknown as NodeRedNode, // missing type
      ];

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('aggregates errors from wiring validation', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [['nonexistent']] },
      ];

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-existent'))).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('aggregates errors from installed nodes validation', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'missing-node', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing-node'))).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('aggregates errors from all validation stages', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { type: 'inject', z: 'tab1', wires: [['bad']] } as NodeRedNode, // missing id + bad wiring
      ];

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('validates empty flow', async () => {
      const nodes: NodeRedNode[] = [];

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tab node'))).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles fetch errors in integrated validation', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'node1', type: 'inject', z: 'tab1', wires: [] },
      ];

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Connection refused'))).toBe(true);
    });

    it('passes complex valid flow with multiple node types', async () => {
      const nodes: NodeRedNode[] = [
        { id: 'tab1', type: 'tab', name: 'Test Flow' },
        { id: 'inject1', type: 'inject', z: 'tab1', wires: [['func1']] },
        { id: 'func1', type: 'function', z: 'tab1', wires: [['switch1']] },
        { id: 'switch1', type: 'switch', z: 'tab1', wires: [['debug1'], ['debug2']] },
        { id: 'debug1', type: 'debug', z: 'tab1', wires: [] },
        { id: 'debug2', type: 'debug', z: 'tab1', wires: [] },
        { id: 'http1', type: 'http in', z: 'tab1', wires: [['httpres1']] },
        { id: 'httpres1', type: 'http response', z: 'tab1', wires: [] },
        { id: 'comment1', type: 'comment', z: 'tab1' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'switch', name: 'switch', types: ['switch'] },
        ],
      });

      const result: FlowValidationResult = await validateFlow(nodes, 1880);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
