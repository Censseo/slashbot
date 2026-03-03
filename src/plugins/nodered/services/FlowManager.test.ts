import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import type { EventBus } from '@slashbot/core/kernel/event-bus.js';
import type { NodeRedState } from '../types';
import type { FlowMetadataFile, FlowMetadata, FlowCreateInput, FlowUpdateInput, NodeRedNode } from '../flow-types';
import * as path from 'path';
import * as os from 'os';

// Mock flow-validator module
vi.mock('../flow-validator', () => ({
  validateFlow: vi.fn(),
}));

import { validateFlow } from '../flow-validator';

// Mock Bun APIs
const mockBunFile = vi.fn();
const mockBunWrite = vi.fn();
vi.stubGlobal('Bun', {
  file: mockBunFile,
  write: mockBunWrite,
});

// Mock fs module for directory operations
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import * as fs from 'fs';
const mockExistsSync = vi.mocked(fs.existsSync);
const mockMkdirSync = vi.mocked(fs.mkdirSync);

// Import FlowManager (will fail until T005 is complete - TDD red phase)
import { FlowManager } from './FlowManager';

describe('FlowManager', () => {
  let manager: FlowManager;
  let mockEventBus: EventBus;
  let mockNodeRedManager: any;
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockFetch: ReturnType<typeof vi.fn>;
  const mockValidateFlow = vi.mocked(validateFlow);

  const METADATA_PATH = path.join('/tmp/test-slashbot', 'nodered', 'flow-metadata.json');

  // Sample metadata for testing
  const sampleMetadata: FlowMetadata = {
    flowId: 'flow-123',
    creator: 'test-user',
    createdAt: '2026-02-16T00:00:00.000Z',
    updatedAt: '2026-02-16T00:00:00.000Z',
    description: 'Test flow',
    tags: ['test', 'sample'],
    mcp: false,
  };

  const sampleMetadataFile: FlowMetadataFile = {
    version: 1,
    flows: {
      'flow-123': sampleMetadata,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock EventBus
    mockEmit = vi.fn();
    mockOn = vi.fn(() => vi.fn()); // Return unsubscribe function
    mockEventBus = {
      publish: mockEmit,
      subscribe: mockOn,
    } as any;

    // Mock NodeRedManager
    mockNodeRedManager = {
      getState: vi.fn(() => 'running' as NodeRedState),
      getConfig: vi.fn(() => ({ port: 1880, enabled: true })),
    };

    // Mock fetch
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    // Reset global mocks
    mockBunFile.mockReset();
    mockBunWrite.mockReset();
    mockExistsSync.mockReset();
    mockMkdirSync.mockReset();
    mockValidateFlow.mockReset();
  });

  describe('constructor', () => {
    it('accepts NodeRedManager and EventBus instances', () => {
      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
      expect(manager).toBeDefined();
    });
  });

  describe('Metadata I/O', () => {
    describe('loadMetadata', () => {
      it('returns empty metadata when file does not exist', async () => {
        // Mock file doesn't exist
        const mockFileObj = {
          exists: vi.fn().mockResolvedValue(false),
          text: vi.fn(),
          json: vi.fn(),
        };
        mockBunFile.mockReturnValue(mockFileObj);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
        const metadata = await manager.loadMetadata();

        expect(metadata).toEqual({ version: 1, flows: {} });
        expect(mockFileObj.exists).toHaveBeenCalled();
        expect(mockFileObj.json).not.toHaveBeenCalled();
      });

      it('loads existing metadata file successfully', async () => {
        // Mock file exists and contains valid data
        const mockFileObj = {
          exists: vi.fn().mockResolvedValue(true),
          text: vi.fn(),
          json: vi.fn().mockResolvedValue(sampleMetadataFile),
        };
        mockBunFile.mockReturnValue(mockFileObj);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
        const metadata = await manager.loadMetadata();

        expect(metadata).toEqual(sampleMetadataFile);
        expect(mockFileObj.exists).toHaveBeenCalled();
        expect(mockFileObj.json).toHaveBeenCalled();
      });

      it('caches metadata after first load', async () => {
        // Mock file exists
        const mockFileObj = {
          exists: vi.fn().mockResolvedValue(true),
          json: vi.fn().mockResolvedValue(sampleMetadataFile),
        };
        mockBunFile.mockReturnValue(mockFileObj);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

        // First load - hits file system
        await manager.loadMetadata();
        expect(mockFileObj.json).toHaveBeenCalledTimes(1);

        // Second load - uses cache
        await manager.loadMetadata();
        expect(mockFileObj.json).toHaveBeenCalledTimes(1); // Still 1, not 2
      });

      it('handles corrupted metadata file gracefully', async () => {
        // Mock file exists but json() throws
        const mockFileObj = {
          exists: vi.fn().mockResolvedValue(true),
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        };
        mockBunFile.mockReturnValue(mockFileObj);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

        await expect(manager.loadMetadata()).rejects.toThrow('Invalid JSON');
      });
    });

    describe('saveMetadata', () => {
      it('saves metadata with pretty formatting', async () => {
        mockBunWrite.mockResolvedValue(undefined);
        mockExistsSync.mockReturnValue(true);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
        await manager.saveMetadata(sampleMetadataFile);

        expect(mockBunWrite).toHaveBeenCalledWith(
          METADATA_PATH,
          JSON.stringify(sampleMetadataFile, null, 2)
        );
      });

      it('creates directory if it does not exist', async () => {
        mockBunWrite.mockResolvedValue(undefined);
        mockExistsSync.mockReturnValue(false);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
        await manager.saveMetadata(sampleMetadataFile);

        expect(mockMkdirSync).toHaveBeenCalledWith(
          path.dirname(METADATA_PATH),
          { recursive: true }
        );
        expect(mockBunWrite).toHaveBeenCalled();
      });

      it('updates cache after save', async () => {
        mockBunWrite.mockResolvedValue(undefined);
        mockExistsSync.mockReturnValue(true);

        // Mock loadMetadata initial state
        const mockFileObj = {
          exists: vi.fn().mockResolvedValue(false),
          json: vi.fn(),
        };
        mockBunFile.mockReturnValue(mockFileObj);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

        // Save new metadata
        await manager.saveMetadata(sampleMetadataFile);

        // Load should now return the saved metadata from cache
        const loaded = await manager.loadMetadata();
        expect(loaded).toEqual(sampleMetadataFile);
        expect(mockFileObj.json).not.toHaveBeenCalled(); // Cache was used
      });

      it('handles write failure', async () => {
        mockBunWrite.mockRejectedValue(new Error('Write failed'));
        mockExistsSync.mockReturnValue(true);

        manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

        await expect(manager.saveMetadata(sampleMetadataFile)).rejects.toThrow('Write failed');
      });
    });
  });

  describe('Schema Version Validation', () => {
    it('accepts version 1 metadata', async () => {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(sampleMetadataFile),
      };
      mockBunFile.mockReturnValue(mockFileObj);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
      const metadata = await manager.loadMetadata();

      expect(metadata.version).toBe(1);
    });

    it('rejects version 2 metadata', async () => {
      const futureMetadata = { version: 2, flows: {} };
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(futureMetadata),
      };
      mockBunFile.mockReturnValue(mockFileObj);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.loadMetadata()).rejects.toThrow(/unsupported.*version.*2/i);
    });

    it('rejects metadata with missing version field', async () => {
      const invalidMetadata = { flows: {} }; // Missing version
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(invalidMetadata),
      };
      mockBunFile.mockReturnValue(mockFileObj);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.loadMetadata()).rejects.toThrow(/missing.*version/i);
    });

    it('validates version on save', async () => {
      const invalidMetadata = { version: 99, flows: {} } as any;

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.saveMetadata(invalidMetadata)).rejects.toThrow(/unsupported.*version/i);
    });
  });

  describe('Readiness Check', () => {
    it('returns true when NodeRedManager state is "running"', () => {
      mockNodeRedManager.getState.mockReturnValue('running' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
      expect(manager.isReady()).toBe(true);
    });

    it('returns false when NodeRedManager state is "stopped"', () => {
      mockNodeRedManager.getState.mockReturnValue('stopped' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
      expect(manager.isReady()).toBe(false);
    });

    it('returns false when NodeRedManager state is "starting"', () => {
      mockNodeRedManager.getState.mockReturnValue('starting' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
      expect(manager.isReady()).toBe(false);
    });

    it('returns false when NodeRedManager state is "disabled"', () => {
      mockNodeRedManager.getState.mockReturnValue('disabled' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
      expect(manager.isReady()).toBe(false);
    });

    it('returns false when NodeRedManager state is "error"', () => {
      mockNodeRedManager.getState.mockReturnValue('error' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
      expect(manager.isReady()).toBe(false);
    });
  });

  describe('Mutex Contention', () => {
    it('serializes concurrent metadata loads', async () => {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockImplementation(() => {
          // Simulate slow I/O
          return new Promise(resolve => setTimeout(() => resolve(sampleMetadataFile), 50));
        }),
      };
      mockBunFile.mockReturnValue(mockFileObj);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      // Start two concurrent loads
      const load1 = manager.loadMetadata();
      const load2 = manager.loadMetadata();

      // Both should succeed
      const [result1, result2] = await Promise.all([load1, load2]);
      expect(result1).toEqual(sampleMetadataFile);
      expect(result2).toEqual(sampleMetadataFile);

      // json() should be called only once due to caching after first load
      expect(mockFileObj.json).toHaveBeenCalledTimes(1);
    });

    it('serializes concurrent metadata saves', async () => {
      mockBunWrite.mockImplementation(() => {
        // Simulate slow write
        return new Promise(resolve => setTimeout(resolve, 50));
      });
      mockExistsSync.mockReturnValue(true);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      const metadata1 = { version: 1 as const, flows: { 'flow-1': sampleMetadata } };
      const metadata2 = { version: 1 as const, flows: { 'flow-2': sampleMetadata } };

      // Start two concurrent saves
      const save1 = manager.saveMetadata(metadata1);
      const save2 = manager.saveMetadata(metadata2);

      // Both should succeed
      await Promise.all([save1, save2]);

      // Both writes should have been called
      expect(mockBunWrite).toHaveBeenCalledTimes(2);
    });

    it('releases lock on load error', async () => {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn()
          .mockRejectedValueOnce(new Error('Transient error'))
          .mockResolvedValueOnce(sampleMetadataFile),
      };
      mockBunFile.mockReturnValue(mockFileObj);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      // First load fails
      await expect(manager.loadMetadata()).rejects.toThrow('Transient error');

      // Second load should succeed (lock was released)
      const result = await manager.loadMetadata();
      expect(result).toEqual(sampleMetadataFile);
    });

    it('releases lock on save error', async () => {
      mockBunWrite
        .mockRejectedValueOnce(new Error('Disk full'))
        .mockResolvedValueOnce(undefined);
      mockExistsSync.mockReturnValue(true);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      // First save fails
      await expect(manager.saveMetadata(sampleMetadataFile)).rejects.toThrow('Disk full');

      // Second save should succeed (lock was released)
      await manager.saveMetadata(sampleMetadataFile);
      expect(mockBunWrite).toHaveBeenCalledTimes(2);
    });

    it('handles multiple operations with mixed load/save', async () => {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(sampleMetadataFile),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockBunWrite.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      // Mix of concurrent operations
      const ops = [
        manager.loadMetadata(),
        manager.saveMetadata(sampleMetadataFile),
        manager.loadMetadata(),
        manager.saveMetadata(sampleMetadataFile),
      ];

      // All should succeed without deadlock
      await expect(Promise.all(ops)).resolves.toBeDefined();
    });
  });

  describe('Event Emission', () => {
    it('does not emit events for metadata I/O operations', async () => {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(sampleMetadataFile),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockBunWrite.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await manager.loadMetadata();
      await manager.saveMetadata(sampleMetadataFile);

      // Metadata I/O should not emit events
      // (Flow events are emitted by CRUD operations, tested in T007+)
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // T007: createFlow tests
  // ==========================================================================
  describe('createFlow', () => {
    const validNodes: NodeRedNode[] = [
      { id: 'tab1', type: 'tab', z: undefined },
      { id: 'n1', type: 'http in', z: 'tab1', url: '/webhook', method: 'post', wires: [['n2']] },
      { id: 'n2', type: 'http response', z: 'tab1', wires: [] },
    ];

    const createInput: FlowCreateInput = {
      label: 'Test Flow',
      nodes: validNodes,
      metadata: {
        creator: 'bot',
        description: 'A test flow',
        tags: ['test'],
        mcp: false,
      },
    };

    function setupReadyManager() {
      // Metadata file doesn't exist yet (fresh start)
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(false),
        json: vi.fn(),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockBunWrite.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);
      mockNodeRedManager.getState.mockReturnValue('running' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
    }

    it('creates a valid flow and returns FlowInfo with id and httpEndpoints', async () => {
      setupReadyManager();

      // Validation passes
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      // Node-RED POST /flow returns assigned ID
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-flow-id' }),
      });

      const result = await manager.createFlow(createInput);

      expect(result.id).toBe('new-flow-id');
      expect(result.label).toBe('Test Flow');
      expect(result.httpEndpoints).toEqual([{ path: '/webhook', method: 'post' }]);
      expect(result.nodeCount).toBe(2); // non-tab nodes
      expect(result.metadata.creator).toBe('bot');
      expect(result.metadata.flowId).toBe('new-flow-id');
      expect(result.metadata.description).toBe('A test flow');
      expect(result.metadata.tags).toEqual(['test']);
      expect(result.metadata.mcp).toBe(false);
    });

    it('rejects invalid flow with validation errors', async () => {
      setupReadyManager();

      mockValidateFlow.mockResolvedValue({
        valid: false,
        errors: ['Flow must contain at least one tab node'],
      });

      await expect(manager.createFlow(createInput)).rejects.toThrow(/validation/i);
    });

    it('throws when Node-RED is not available', async () => {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(false),
        json: vi.fn(),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockNodeRedManager.getState.mockReturnValue('stopped' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.createFlow(createInput)).rejects.toThrow(/not available/i);
    });

    it('extracts HTTP endpoint URLs from http in nodes', async () => {
      setupReadyManager();
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      const nodesWithMultipleEndpoints: NodeRedNode[] = [
        { id: 'tab1', type: 'tab' },
        { id: 'n1', type: 'http in', z: 'tab1', url: '/api/users', method: 'get', wires: [['n3']] },
        { id: 'n2', type: 'http in', z: 'tab1', url: '/api/orders', method: 'post', wires: [['n3']] },
        { id: 'n3', type: 'http response', z: 'tab1', wires: [] },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'flow-multi' }),
      });

      const result = await manager.createFlow({
        ...createInput,
        nodes: nodesWithMultipleEndpoints,
      });

      expect(result.httpEndpoints).toEqual([{ path: '/api/users', method: 'get' }, { path: '/api/orders', method: 'post' }]);
    });

    it('stores metadata in flow-metadata.json', async () => {
      setupReadyManager();
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'stored-flow-id' }),
      });

      await manager.createFlow(createInput);

      // Verify saveMetadata was called (via Bun.write)
      expect(mockBunWrite).toHaveBeenCalled();

      // Parse what was written and verify metadata entry
      const writtenData = JSON.parse(mockBunWrite.mock.calls[0][1]);
      expect(writtenData.flows['stored-flow-id']).toBeDefined();
      expect(writtenData.flows['stored-flow-id'].creator).toBe('bot');
      expect(writtenData.flows['stored-flow-id'].flowId).toBe('stored-flow-id');
    });

    it('emits flow:created event after successful creation', async () => {
      setupReadyManager();
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'event-flow-id' }),
      });

      await manager.createFlow(createInput);

      expect(mockEmit).toHaveBeenCalledWith(
        'flow:created',
        expect.objectContaining({
          flowId: 'event-flow-id',
          label: 'Test Flow',
        })
      );
    });

    it('sends POST /flow to Node-RED API with correct body', async () => {
      setupReadyManager();
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'posted-flow' }),
      });

      await manager.createFlow(createInput);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1880/flow',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Node-RED-Deployment-Type': 'flows',
          }),
        })
      );

      // Verify body contains label and nodes
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.label).toBe('Test Flow');
      expect(body.nodes).toBeDefined();
    });

    it('throws when Node-RED API returns error', async () => {
      setupReadyManager();
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(manager.createFlow(createInput)).rejects.toThrow();
    });

    it('uses default metadata when metadata input is omitted', async () => {
      setupReadyManager();
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'default-meta-flow' }),
      });

      const inputWithoutMeta: FlowCreateInput = {
        label: 'No Meta Flow',
        nodes: validNodes,
      };

      const result = await manager.createFlow(inputWithoutMeta);

      expect(result.metadata.creator).toBe('unknown');
      expect(result.metadata.description).toBe('');
      expect(result.metadata.tags).toEqual([]);
      expect(result.metadata.mcp).toBe(false);
    });
  });

  // ==========================================================================
  // T008: getFlow tests
  // ==========================================================================
  describe('getFlow', () => {
    function setupReadyManagerWithMetadata(metadata: FlowMetadataFile) {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(metadata),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockBunWrite.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);
      mockNodeRedManager.getState.mockReturnValue('running' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
    }

    it('returns FlowInfo for an existing flow', async () => {
      const metadata: FlowMetadataFile = {
        version: 1,
        flows: {
          'flow-abc': {
            flowId: 'flow-abc',
            creator: 'bot',
            createdAt: '2026-02-16T00:00:00.000Z',
            updatedAt: '2026-02-16T00:00:00.000Z',
            description: 'Test flow',
            tags: ['test'],
            mcp: false,
          },
        },
      };

      setupReadyManagerWithMetadata(metadata);

      // GET /flow/:id returns flow detail
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'flow-abc',
          label: 'My Flow',
          nodes: [
            { id: 'n1', type: 'http in', url: '/test', wires: [['n2']] },
            { id: 'n2', type: 'debug', wires: [] },
          ],
          configs: [],
        }),
      });

      const result = await manager.getFlow('flow-abc');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('flow-abc');
      expect(result!.label).toBe('My Flow');
      expect(result!.nodeCount).toBe(2);
      expect(result!.httpEndpoints).toEqual([{ path: '/test', method: 'get' }]);
      expect(result!.metadata.creator).toBe('bot');
    });

    it('returns null when flow is not found (404)', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await manager.getFlow('nonexistent');

      expect(result).toBeNull();
    });

    it('enriches with default metadata when metadata is missing', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'flow-no-meta',
          label: 'Orphan Flow',
          nodes: [{ id: 'n1', type: 'debug', wires: [] }],
          configs: [],
        }),
      });

      const result = await manager.getFlow('flow-no-meta');

      expect(result).not.toBeNull();
      expect(result!.metadata.creator).toBe('unknown');
      expect(result!.metadata.mcp).toBe(false);
    });

    it('throws when Node-RED is not available', async () => {
      const mockFileObj = { exists: vi.fn().mockResolvedValue(false), json: vi.fn() };
      mockBunFile.mockReturnValue(mockFileObj);
      mockNodeRedManager.getState.mockReturnValue('stopped' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.getFlow('any-id')).rejects.toThrow(/not available/i);
    });

    it('throws on non-404 API errors', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(manager.getFlow('flow-err')).rejects.toThrow();
    });

    it('calls GET /flow/:id with correct URL', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'flow-url-test',
          label: 'Test',
          nodes: [],
          configs: [],
        }),
      });

      await manager.getFlow('flow-url-test');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:1880/flow/flow-url-test', undefined);
    });
  });

  // ==========================================================================
  // T012: listFlows tests
  // ==========================================================================
  describe('listFlows', () => {
    function setupReadyManagerWithMetadata(metadata: FlowMetadataFile) {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(metadata),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockBunWrite.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);
      mockNodeRedManager.getState.mockReturnValue('running' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
    }

    it('returns multiple flows enriched with metadata', async () => {
      const metadata: FlowMetadataFile = {
        version: 1,
        flows: {
          'flow-1': {
            flowId: 'flow-1',
            creator: 'bot',
            createdAt: '2026-02-16T00:00:00.000Z',
            updatedAt: '2026-02-16T00:00:00.000Z',
            description: 'First flow',
            tags: ['test'],
            mcp: false,
          },
          'flow-2': {
            flowId: 'flow-2',
            creator: 'human',
            createdAt: '2026-02-16T01:00:00.000Z',
            updatedAt: '2026-02-16T01:00:00.000Z',
            description: 'Second flow',
            tags: [],
            mcp: true,
          },
        },
      };

      setupReadyManagerWithMetadata(metadata);

      // GET /flows returns all nodes including tabs
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ([
          { id: 'flow-1', type: 'tab', label: 'Flow One' },
          { id: 'n1', type: 'http in', z: 'flow-1', url: '/api', wires: [] },
          { id: 'n2', type: 'debug', z: 'flow-1', wires: [] },
          { id: 'flow-2', type: 'tab', label: 'Flow Two' },
          { id: 'n3', type: 'inject', z: 'flow-2', wires: [] },
        ]),
      });

      const result = await manager.listFlows();

      expect(result).toHaveLength(2);

      const f1 = result.find(f => f.id === 'flow-1')!;
      expect(f1.label).toBe('Flow One');
      expect(f1.nodeCount).toBe(2);
      expect(f1.httpEndpoints).toEqual([{ path: '/api', method: 'get' }]);
      expect(f1.metadata.creator).toBe('bot');

      const f2 = result.find(f => f.id === 'flow-2')!;
      expect(f2.label).toBe('Flow Two');
      expect(f2.nodeCount).toBe(1);
      expect(f2.httpEndpoints).toEqual([]);
      expect(f2.metadata.creator).toBe('human');
      expect(f2.metadata.mcp).toBe(true);
    });

    it('returns empty array when no flows exist', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ([]),
      });

      const result = await manager.listFlows();

      expect(result).toEqual([]);
    });

    it('enriches flows without metadata with defaults', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ([
          { id: 'orphan-flow', type: 'tab', label: 'Orphan' },
          { id: 'n1', type: 'debug', z: 'orphan-flow', wires: [] },
        ]),
      });

      const result = await manager.listFlows();

      expect(result).toHaveLength(1);
      expect(result[0].metadata.creator).toBe('unknown');
      expect(result[0].metadata.mcp).toBe(false);
      expect(result[0].metadata.description).toBe('');
      expect(result[0].metadata.tags).toEqual([]);
    });

    it('handles metadata reconciliation — only returns flows present in Node-RED', async () => {
      const metadata: FlowMetadataFile = {
        version: 1,
        flows: {
          'existing-flow': {
            flowId: 'existing-flow',
            creator: 'bot',
            createdAt: '2026-02-16T00:00:00.000Z',
            updatedAt: '2026-02-16T00:00:00.000Z',
            description: 'Exists',
            tags: [],
            mcp: false,
          },
          'deleted-flow': {
            flowId: 'deleted-flow',
            creator: 'bot',
            createdAt: '2026-02-16T00:00:00.000Z',
            updatedAt: '2026-02-16T00:00:00.000Z',
            description: 'No longer in Node-RED',
            tags: [],
            mcp: false,
          },
        },
      };

      setupReadyManagerWithMetadata(metadata);

      // Only 'existing-flow' is in Node-RED
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ([
          { id: 'existing-flow', type: 'tab', label: 'Existing' },
        ]),
      });

      const result = await manager.listFlows();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('existing-flow');
    });

    it('throws when Node-RED is not available', async () => {
      const mockFileObj = { exists: vi.fn().mockResolvedValue(false), json: vi.fn() };
      mockBunFile.mockReturnValue(mockFileObj);
      mockNodeRedManager.getState.mockReturnValue('stopped' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.listFlows()).rejects.toThrow(/not available/i);
    });

    it('throws on Node-RED API error', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(manager.listFlows()).rejects.toThrow();
    });

    it('calls GET /flows with correct URL', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ([]),
      });

      await manager.listFlows();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:1880/flows', undefined);
    });
  });

  // ==========================================================================
  // T014: deleteFlow tests
  // ==========================================================================
  describe('deleteFlow', () => {
    const flowMetadata: FlowMetadata = {
      flowId: 'flow-del',
      creator: 'bot',
      createdAt: '2026-02-16T00:00:00.000Z',
      updatedAt: '2026-02-16T00:00:00.000Z',
      description: 'Flow to delete',
      tags: ['temp'],
      mcp: false,
    };

    function setupReadyManagerWithMetadata(metadata: FlowMetadataFile) {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(metadata),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockBunWrite.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);
      mockNodeRedManager.getState.mockReturnValue('running' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
    }

    it('successfully deletes an existing flow', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-del': flowMetadata },
      });

      // GET /flow/:id to verify existence
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-del',
            label: 'Flow to delete',
            nodes: [],
            configs: [],
          }),
        })
        // DELETE /flow/:id succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

      await expect(manager.deleteFlow('flow-del')).resolves.toBeUndefined();
    });

    it('calls DELETE /flow/:id with correct URL', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-del': flowMetadata },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-del',
            label: 'Test',
            nodes: [],
            configs: [],
          }),
        })
        .mockResolvedValueOnce({ ok: true, status: 204 });

      await manager.deleteFlow('flow-del');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1880/flow/flow-del',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws when flow is not found (404)', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(manager.deleteFlow('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('emits flow:deleted event after successful deletion', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-del': flowMetadata },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-del',
            label: 'Flow to delete',
            nodes: [],
            configs: [],
          }),
        })
        .mockResolvedValueOnce({ ok: true, status: 204 });

      await manager.deleteFlow('flow-del');

      expect(mockEmit).toHaveBeenCalledWith(
        'flow:deleted',
        expect.objectContaining({
          flowId: 'flow-del',
        })
      );
    });

    it('removes metadata entry after deletion', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-del': flowMetadata },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-del',
            label: 'Flow to delete',
            nodes: [],
            configs: [],
          }),
        })
        .mockResolvedValueOnce({ ok: true, status: 204 });

      await manager.deleteFlow('flow-del');

      // Verify metadata was saved without the deleted flow's entry
      expect(mockBunWrite).toHaveBeenCalled();
      const writtenData = JSON.parse(mockBunWrite.mock.calls[0][1]);
      expect(writtenData.flows['flow-del']).toBeUndefined();
    });

    it('throws when Node-RED is not available', async () => {
      const mockFileObj = { exists: vi.fn().mockResolvedValue(false), json: vi.fn() };
      mockBunFile.mockReturnValue(mockFileObj);
      mockNodeRedManager.getState.mockReturnValue('stopped' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.deleteFlow('any-id')).rejects.toThrow(/not available/i);
    });

    it('throws on non-404 API errors during existence check', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(manager.deleteFlow('flow-err')).rejects.toThrow();
    });

    it('handles deletion of flow without metadata gracefully', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-no-meta',
            label: 'No Meta',
            nodes: [],
            configs: [],
          }),
        })
        .mockResolvedValueOnce({ ok: true, status: 204 });

      await expect(manager.deleteFlow('flow-no-meta')).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // T016: updateFlow tests
  // ==========================================================================
  describe('updateFlow', () => {
    const existingMetadata: FlowMetadata = {
      flowId: 'flow-upd',
      creator: 'bot',
      createdAt: '2026-02-16T00:00:00.000Z',
      updatedAt: '2026-02-16T00:00:00.000Z',
      description: 'Original flow',
      tags: ['original'],
      mcp: false,
    };

    function setupReadyManagerWithMetadata(metadata: FlowMetadataFile) {
      const mockFileObj = {
        exists: vi.fn().mockResolvedValue(true),
        json: vi.fn().mockResolvedValue(metadata),
      };
      mockBunFile.mockReturnValue(mockFileObj);
      mockBunWrite.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);
      mockNodeRedManager.getState.mockReturnValue('running' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');
    }

    it('successfully updates an existing flow and returns FlowInfo', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-upd': existingMetadata },
      });

      // GET /flow/:id to fetch current state
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-upd',
            label: 'Original Label',
            nodes: [
              { id: 'n1', type: 'debug', z: 'flow-upd', wires: [] },
            ],
            configs: [],
          }),
        });

      // Validation passes
      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      // PUT /flow/:id succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'flow-upd' }),
      });

      const updateInput: FlowUpdateInput = {
        label: 'Updated Label',
        nodes: [
          { id: 'n1', type: 'http in', z: 'flow-upd', url: '/updated', wires: [] },
        ],
      };

      const result = await manager.updateFlow('flow-upd', updateInput);

      expect(result.id).toBe('flow-upd');
      expect(result.label).toBe('Updated Label');
      expect(result.httpEndpoints).toEqual([{ path: '/updated', method: 'get' }]);
      expect(result.metadata.flowId).toBe('flow-upd');
    });

    it('rejects update with invalid flow definition', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-upd': existingMetadata },
      });

      // GET /flow/:id
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'flow-upd',
          label: 'Original',
          nodes: [{ id: 'n1', type: 'debug', z: 'flow-upd', wires: [] }],
          configs: [],
        }),
      });

      mockValidateFlow.mockResolvedValue({
        valid: false,
        errors: ['Invalid wiring reference'],
      });

      const updateInput: FlowUpdateInput = {
        nodes: [{ id: 'bad', type: 'debug', wires: [['nonexistent']] }],
      };

      await expect(manager.updateFlow('flow-upd', updateInput)).rejects.toThrow(/validation/i);
    });

    it('throws when flow is not found (404)', async () => {
      setupReadyManagerWithMetadata({ version: 1, flows: {} });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(manager.updateFlow('nonexistent', { label: 'New' })).rejects.toThrow(/not found/i);
    });

    it('updates metadata (description, tags) on successful update', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-upd': existingMetadata },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-upd',
            label: 'Original',
            nodes: [{ id: 'n1', type: 'debug', z: 'flow-upd', wires: [] }],
            configs: [],
          }),
        });

      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'flow-upd' }),
      });

      await manager.updateFlow('flow-upd', {
        metadata: {
          description: 'Updated description',
          tags: ['updated', 'v2'],
        },
      });

      // Verify metadata was saved with updated fields
      expect(mockBunWrite).toHaveBeenCalled();
      const writtenData = JSON.parse(mockBunWrite.mock.calls[0][1]);
      expect(writtenData.flows['flow-upd'].description).toBe('Updated description');
      expect(writtenData.flows['flow-upd'].tags).toEqual(['updated', 'v2']);
      // Creator should be preserved
      expect(writtenData.flows['flow-upd'].creator).toBe('bot');
    });

    it('emits flow:updated event after successful update', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-upd': existingMetadata },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-upd',
            label: 'Original',
            nodes: [{ id: 'n1', type: 'debug', z: 'flow-upd', wires: [] }],
            configs: [],
          }),
        });

      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'flow-upd' }),
      });

      await manager.updateFlow('flow-upd', { label: 'Updated' });

      expect(mockEmit).toHaveBeenCalledWith(
        'flow:updated',
        expect.objectContaining({
          flowId: 'flow-upd',
        })
      );
    });

    it('sends PUT /flow/:id with correct headers and body', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-upd': existingMetadata },
      });

      const updatedNodes: NodeRedNode[] = [
        { id: 'n1', type: 'inject', z: 'flow-upd', wires: [['n2']] },
        { id: 'n2', type: 'debug', z: 'flow-upd', wires: [] },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-upd',
            label: 'Original',
            nodes: [{ id: 'n1', type: 'debug', z: 'flow-upd', wires: [] }],
            configs: [],
          }),
        });

      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'flow-upd' }),
      });

      await manager.updateFlow('flow-upd', {
        label: 'Updated Flow',
        nodes: updatedNodes,
      });

      // Second fetch call is the PUT
      const putCall = mockFetch.mock.calls[1];
      expect(putCall[0]).toBe('http://localhost:1880/flow/flow-upd');
      expect(putCall[1].method).toBe('PUT');
      expect(putCall[1].headers['Node-RED-Deployment-Type']).toBe('flows');
      expect(putCall[1].headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(putCall[1].body);
      expect(body.label).toBe('Updated Flow');
      expect(body.nodes).toEqual(updatedNodes);
    });

    it('throws when Node-RED is not available', async () => {
      const mockFileObj = { exists: vi.fn().mockResolvedValue(false), json: vi.fn() };
      mockBunFile.mockReturnValue(mockFileObj);
      mockNodeRedManager.getState.mockReturnValue('stopped' as NodeRedState);

      manager = new FlowManager(mockNodeRedManager, mockEventBus, '/tmp/test-slashbot');

      await expect(manager.updateFlow('any-id', { label: 'New' })).rejects.toThrow(/not available/i);
    });

    it('preserves existing nodes/configs when only updating label or metadata', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-upd': existingMetadata },
      });

      const existingNodes = [
        { id: 'n1', type: 'inject', z: 'flow-upd', wires: [['n2']] },
        { id: 'n2', type: 'debug', z: 'flow-upd', wires: [] },
      ];
      const existingConfigs = [{ id: 'c1', type: 'mqtt-broker', z: 'flow-upd' }];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-upd',
            label: 'Original',
            nodes: existingNodes,
            configs: existingConfigs,
          }),
        });

      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'flow-upd' }),
      });

      // Only update label, no nodes/configs provided
      await manager.updateFlow('flow-upd', { label: 'New Label' });

      // PUT body should use existing nodes/configs
      const putCall = mockFetch.mock.calls[1];
      const body = JSON.parse(putCall[1].body);
      expect(body.nodes).toEqual(existingNodes);
      expect(body.configs).toEqual(existingConfigs);
      expect(body.label).toBe('New Label');
    });

    it('updates updatedAt timestamp on metadata', async () => {
      setupReadyManagerWithMetadata({
        version: 1,
        flows: { 'flow-upd': existingMetadata },
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'flow-upd',
            label: 'Original',
            nodes: [],
            configs: [],
          }),
        });

      mockValidateFlow.mockResolvedValue({ valid: true, errors: [] });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'flow-upd' }),
      });

      await manager.updateFlow('flow-upd', { label: 'Updated' });

      const writtenData = JSON.parse(mockBunWrite.mock.calls[0][1]);
      // updatedAt should be different from the original
      expect(writtenData.flows['flow-upd'].updatedAt).not.toBe('2026-02-16T00:00:00.000Z');
      // createdAt should be preserved
      expect(writtenData.flows['flow-upd'].createdAt).toBe('2026-02-16T00:00:00.000Z');
    });
  });
});
