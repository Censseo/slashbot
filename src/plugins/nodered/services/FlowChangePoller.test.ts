import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlowChangePoller, type IFlowPoller } from './FlowChangePoller.js';
import { McpBridgeService } from './McpBridgeService.js';
import type { FlowInfo } from '../flow-types.js';
import type { EventBus, EventEnvelope } from '@slashbot/core/kernel/event-bus.js';

function makeFlow(id: string, label: string, nodeCount: number): FlowInfo {
  return {
    id,
    label,
    nodeCount,
    httpEndpoints: [],
    metadata: {
      flowId: id,
      creator: 'test',
      createdAt: '',
      updatedAt: '',
      description: '',
      tags: [],
      mcp: false,
    },
  };
}

describe('FlowChangePoller', () => {
  let mockFlowManager: {
    listFlows: ReturnType<typeof vi.fn>;
    getFlowsRevisionHash: ReturnType<typeof vi.fn>;
    getLastKnownHash: ReturnType<typeof vi.fn>;
    updateLastKnownHash: ReturnType<typeof vi.fn>;
  };
  let mockEvents: { publish: ReturnType<typeof vi.fn> };
  let poller: FlowChangePoller;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    mockFlowManager = {
      listFlows: vi.fn().mockResolvedValue([]),
      getFlowsRevisionHash: vi.fn().mockResolvedValue('abc'),
      getLastKnownHash: vi.fn().mockReturnValue(null),
      updateLastKnownHash: vi.fn(),
    };
    mockEvents = { publish: vi.fn() };
    poller = new FlowChangePoller(mockFlowManager as IFlowPoller, mockEvents);
  });

  afterEach(() => {
    poller.stop();
    vi.useRealTimers();
  });

  it('first poll sets baseline without emitting event', async () => {
    const flows = [makeFlow('f1', 'Flow 1', 3)];
    mockFlowManager.getFlowsRevisionHash.mockResolvedValue('abc');
    mockFlowManager.listFlows.mockResolvedValue(flows);

    poller.start();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockFlowManager.getFlowsRevisionHash).toHaveBeenCalled();
    expect(mockEvents.publish).not.toHaveBeenCalled();
    expect(poller.getLastHash()).toBe('abc');
  });

  it('poll detects hash change and emits flow:external-change', async () => {
    const flowsInitial = [makeFlow('f1', 'Flow 1', 3)];
    const flowsChanged = [makeFlow('f1', 'Flow 1', 5)];

    mockFlowManager.getFlowsRevisionHash.mockResolvedValueOnce('abc');
    mockFlowManager.listFlows.mockResolvedValueOnce(flowsInitial);

    poller.start();
    // First poll: baseline
    await vi.advanceTimersByTimeAsync(15_000);

    mockFlowManager.getFlowsRevisionHash.mockResolvedValueOnce('def');
    mockFlowManager.listFlows.mockResolvedValueOnce(flowsChanged);

    // Second poll: detect change
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockEvents.publish).toHaveBeenCalledWith(
      'flow:external-change',
      expect.objectContaining({
        type: 'flow:external-change',
        previousHash: 'abc',
        currentHash: 'def',
        changes: [{ flowId: 'f1', changeType: 'modified', label: 'Flow 1' }],
      }),
    );
  });

  it('poll with same hash emits no event', async () => {
    mockFlowManager.getFlowsRevisionHash.mockResolvedValue('abc');
    mockFlowManager.listFlows.mockResolvedValue([makeFlow('f1', 'Flow 1', 3)]);

    poller.start();
    await vi.advanceTimersByTimeAsync(15_000); // baseline
    await vi.advanceTimersByTimeAsync(15_000); // same hash

    expect(mockEvents.publish).not.toHaveBeenCalled();
  });

  it('bot CRUD updateHash prevents false positive', async () => {
    mockFlowManager.getFlowsRevisionHash.mockResolvedValueOnce('abc');
    mockFlowManager.listFlows.mockResolvedValue([makeFlow('f1', 'Flow 1', 3)]);

    poller.start();
    await vi.advanceTimersByTimeAsync(15_000); // baseline

    // Bot updates hash to 'xyz'
    poller.updateHash('xyz');
    mockFlowManager.getFlowsRevisionHash.mockResolvedValueOnce('xyz');

    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockEvents.publish).not.toHaveBeenCalled();
  });

  it('start/stop lifecycle — no polls after stop', async () => {
    poller.start();
    poller.stop();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mockFlowManager.getFlowsRevisionHash).not.toHaveBeenCalled();
  });

  it('guards against double-start', async () => {
    mockFlowManager.getFlowsRevisionHash.mockResolvedValue('abc');
    mockFlowManager.listFlows.mockResolvedValue([]);

    poller.start();
    poller.start(); // second call should be no-op

    await vi.advanceTimersByTimeAsync(15_000);

    // Should only poll once per interval, not twice
    expect(mockFlowManager.getFlowsRevisionHash).toHaveBeenCalledTimes(1);
  });

  it('API failure does not crash — retries next interval', async () => {
    mockFlowManager.getFlowsRevisionHash.mockRejectedValueOnce(new Error('network'));
    mockFlowManager.getFlowsRevisionHash.mockResolvedValueOnce('abc');
    mockFlowManager.listFlows.mockResolvedValue([]);

    poller.start();
    await vi.advanceTimersByTimeAsync(15_000); // fails gracefully
    await vi.advanceTimersByTimeAsync(15_000); // succeeds, sets baseline

    expect(poller.getLastHash()).toBe('abc');
  });

  it('computes FlowChange[] with created, modified, and deleted', async () => {
    const initialFlows = [
      makeFlow('f1', 'Flow 1', 3),
      makeFlow('f2', 'Flow 2', 5),
    ];
    const changedFlows = [
      makeFlow('f1', 'Flow 1', 7), // modified (nodeCount changed)
      makeFlow('f3', 'New Flow', 2), // created
      // f2 deleted
    ];

    mockFlowManager.getFlowsRevisionHash.mockResolvedValueOnce('hash1');
    mockFlowManager.listFlows.mockResolvedValueOnce(initialFlows);

    poller.start();
    await vi.advanceTimersByTimeAsync(15_000); // baseline

    mockFlowManager.getFlowsRevisionHash.mockResolvedValueOnce('hash2');
    mockFlowManager.listFlows.mockResolvedValueOnce(changedFlows);

    await vi.advanceTimersByTimeAsync(15_000); // detect changes

    expect(mockEvents.publish).toHaveBeenCalledWith(
      'flow:external-change',
      expect.objectContaining({
        changes: expect.arrayContaining([
          { flowId: 'f1', changeType: 'modified', label: 'Flow 1' },
          { flowId: 'f3', changeType: 'created', label: 'New Flow' },
          { flowId: 'f2', changeType: 'deleted', label: 'Flow 2' },
        ]),
      }),
    );
  });

  it('uses getLastKnownHash from flowManager on start', () => {
    mockFlowManager.getLastKnownHash.mockReturnValue('existing-hash');

    poller.start();

    expect(poller.getLastHash()).toBe('existing-hash');
  });
});

describe('FlowChangePoller + McpBridgeService integration', () => {
  function makeFlowWithEndpoint(id: string, label: string, nodeCount: number): FlowInfo {
    return {
      id,
      label,
      nodeCount,
      httpEndpoints: [{ path: `/api/${id}`, method: 'post' }],
      metadata: {
        flowId: id,
        creator: 'editor',
        createdAt: '',
        updatedAt: '',
        description: '',
        tags: [],
        mcp: false,
      },
    };
  }

  it('new mcp- prefixed flow created in editor is registered as MCP tool', async () => {
    vi.useFakeTimers();

    // Shared event bus (real pub/sub)
    const subscribers = new Map<string, Set<(event: EventEnvelope) => void>>();
    const eventBus: Pick<EventBus, 'subscribe' | 'publish'> = {
      subscribe(event: string, handler: (event: EventEnvelope) => void) {
        if (!subscribers.has(event)) subscribers.set(event, new Set());
        subscribers.get(event)!.add(handler);
        return () => { subscribers.get(event)?.delete(handler); };
      },
      publish(event: string, data: unknown) {
        for (const handler of subscribers.get(event) ?? []) handler(data as EventEnvelope);
      },
    };

    const mockFlowManager = {
      listFlows: vi.fn().mockResolvedValue([]),
      getFlowsRevisionHash: vi.fn().mockResolvedValue('hash1'),
      getLastKnownHash: vi.fn().mockReturnValue(null),
      updateLastKnownHash: vi.fn(),
    };

    const registeredToolIds: string[] = [];
    const mockContext = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerTool: vi.fn((tool: { id: string }) => { registeredToolIds.push(tool.id); }),
      unregisterTool: vi.fn(),
    };

    // Wire up
    const poller = new FlowChangePoller(mockFlowManager, eventBus);
    const bridge = new McpBridgeService(mockFlowManager as any, eventBus, mockContext as any);
    await bridge.init();

    poller.start();

    // First poll: baseline (no flows)
    await vi.advanceTimersByTimeAsync(15_000);

    // Simulate: user creates two flows in the editor
    const mcpFlow = makeFlowWithEndpoint('f-new-1', 'mcp-complex-pipeline', 5);
    const regularFlow = makeFlowWithEndpoint('f-new-2', 'my-regular-flow', 3);

    mockFlowManager.getFlowsRevisionHash.mockResolvedValue('hash2');
    mockFlowManager.listFlows.mockResolvedValue([mcpFlow, regularFlow]);

    // Second poll: detect new flows
    await vi.advanceTimersByTimeAsync(15_000);

    // mcp- prefixed flow should be registered
    expect(registeredToolIds).toContain('nodered:mcp-complex-pipeline');
    // Non-prefixed flow should NOT be registered
    expect(registeredToolIds).not.toContain('nodered:my-regular-flow');

    poller.stop();
    bridge.dispose();
    vi.useRealTimers();
  });

  it('new flow without mcp- prefix and without mcp:true is ignored', async () => {
    vi.useFakeTimers();

    const subscribers = new Map<string, Set<(event: EventEnvelope) => void>>();
    const eventBus: Pick<EventBus, 'subscribe' | 'publish'> = {
      subscribe(event: string, handler: (event: EventEnvelope) => void) {
        if (!subscribers.has(event)) subscribers.set(event, new Set());
        subscribers.get(event)!.add(handler);
        return () => { subscribers.get(event)?.delete(handler); };
      },
      publish(event: string, data: unknown) {
        for (const handler of subscribers.get(event) ?? []) handler(data as EventEnvelope);
      },
    };

    const mockFlowManager = {
      listFlows: vi.fn().mockResolvedValue([]),
      getFlowsRevisionHash: vi.fn().mockResolvedValue('h1'),
      getLastKnownHash: vi.fn().mockReturnValue(null),
      updateLastKnownHash: vi.fn(),
    };

    const registeredToolIds: string[] = [];
    const mockContext = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerTool: vi.fn((tool: { id: string }) => { registeredToolIds.push(tool.id); }),
      unregisterTool: vi.fn(),
    };

    const poller = new FlowChangePoller(mockFlowManager, eventBus);
    const bridge = new McpBridgeService(mockFlowManager as any, eventBus, mockContext as any);
    await bridge.init();

    poller.start();
    await vi.advanceTimersByTimeAsync(15_000); // baseline

    // Only non-mcp flows created
    const regularFlow = makeFlowWithEndpoint('f1', 'temperature-monitor', 4);
    mockFlowManager.getFlowsRevisionHash.mockResolvedValue('h2');
    mockFlowManager.listFlows.mockResolvedValue([regularFlow]);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(registeredToolIds).toHaveLength(0);

    poller.stop();
    bridge.dispose();
    vi.useRealTimers();
  });
});
