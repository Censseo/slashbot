/**
 * McpBridgeService tests
 *
 * Test scaffolding — unit and integration tests for the MCP bridge.
 * Tests are organised by user story and written test-first (TDD).
 *
 * Phase 2: scaffold + imports only.
 * Phase 3: US1 tests (T006–T010).
 * Phase 4: US2 tests (T018–T020).
 * Phase 5: US3 tests (T024–T026).
 * Phase 6: US4 tests (T031).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FlowInfo, FlowMetadata, ParamDescriptor } from '../../../../src/plugins/nodered/flow-types.js';

// These imports will resolve once the service is implemented (Phase 3 / T011).
// Import is intentionally commented out so tests show as "red" (TDD) until T011 is done.
import { McpBridgeService } from '../../../../src/plugins/nodered/services/McpBridgeService.js';

// ---------------------------------------------------------------------------
// Shared test helpers / mocks
// ---------------------------------------------------------------------------

/** Minimal PluginRegistrationContext mock — matches PluginRegistrationContext from contracts.ts */
function makeContext() {
  return {
    registerTool: vi.fn(),
    unregisterTool: vi.fn(),
    registerCommand: vi.fn(),
    registerHook: vi.fn(),
    registerProvider: vi.fn(),
    registerGatewayMethod: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerService: vi.fn(),
    getService: vi.fn(),
    registerChannel: vi.fn(),
    contributePromptSection: vi.fn(),
    contributeContextProvider: vi.fn(),
    contributeStatusIndicator: vi.fn(),
    dispatchHook: vi.fn(),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

/** Minimal EventBus mock — uses publish/subscribe API (not on/emit) */
function makeEventBus() {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(() => vi.fn()), // Returns an unsubscribe function
    subscribeAll: vi.fn(() => vi.fn()),
  };
}

/**
 * Functional EventBus mock — actually dispatches events to subscribers.
 * Used in integration tests that verify event-driven behaviour end-to-end.
 * The EventEnvelope shape is: { type, payload, at } where `at` is an ISO string.
 */
function makeFunctionalEventBus() {
  const subscribers = new Map<string, Array<(e: any) => void>>();
  return {
    subscribe: vi.fn((type: string, handler: (e: any) => void) => {
      const list = subscribers.get(type) ?? [];
      list.push(handler);
      subscribers.set(type, list);
      return vi.fn(); // unsubscribe noop
    }),
    publish: vi.fn((type: string, payload: Record<string, unknown>) => {
      const envelope = { type, payload, at: new Date().toISOString() };
      for (const h of subscribers.get(type) ?? []) h(envelope);
    }),
    subscribeAll: vi.fn(() => vi.fn()),
  };
}

/** Build a FlowInfo object with sensible defaults for tests */
function makeFlowInfo(overrides: Partial<FlowInfo> = {}): FlowInfo {
  const now = new Date().toISOString();
  return {
    id: 'flow-1',
    label: 'My Flow',
    nodeCount: 3,
    httpEndpoints: [] as { path: string; method: string }[],
    metadata: {
      flowId: 'flow-1',
      creator: 'test',
      createdAt: now,
      updatedAt: now,
      description: '',
      tags: [],
      mcp: false,
    },
    ...overrides,
  };
}

/** Build a FlowInfo that is eligible for MCP (has HTTP endpoints and mcp:true) */
function makeEligibleFlow(overrides: Partial<FlowInfo> = {}): FlowInfo {
  const base = makeFlowInfo({
    httpEndpoints: [{ path: '/my-flow', method: 'get' }],
    metadata: {
      ...makeFlowInfo().metadata,
      mcp: true,
    },
  });
  return { ...base, ...overrides };
}

/** Minimal FlowManager mock */
function makeFlowManager(flows: FlowInfo[] = []) {
  return {
    listFlows: vi.fn().mockResolvedValue(flows),
  };
}

// ---------------------------------------------------------------------------
// US1: scanAndRegister + isEligible + slugifyLabel + buildSchema (T006–T009)
// ---------------------------------------------------------------------------

describe('McpBridgeService', () => {
  let ctx: ReturnType<typeof makeContext>;
  let eventBus: ReturnType<typeof makeEventBus>;

  beforeEach(() => {
    ctx = makeContext();
    eventBus = makeEventBus();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T006: isEligible — tested indirectly via scanAndRegister
  // ──────────────────────────────────────────────────────────────────────────

  describe('isEligible (via scanAndRegister)', () => {
    it('registers a flow with httpEndpoints and mcp:true', async () => {
      const flow = makeEligibleFlow();
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      expect(ctx.registerTool).toHaveBeenCalledOnce();
    });

    it('registers a flow with mcp-<name> label pattern even without mcp:true flag', async () => {
      const flow = makeFlowInfo({
        id: 'flow-mcp-label',
        label: 'mcp-check-sol-price',
        httpEndpoints: [{ path: '/check-sol-price', method: 'get' }],
        metadata: {
          ...makeFlowInfo().metadata,
          flowId: 'flow-mcp-label',
          mcp: false, // flag is false, but label starts with "mcp-"
        },
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      expect(ctx.registerTool).toHaveBeenCalledOnce();
    });

    it('does not register a flow without httpEndpoints', async () => {
      const flow = makeFlowInfo({
        httpEndpoints: [] as { path: string; method: string }[], // no HTTP endpoint
        metadata: { ...makeFlowInfo().metadata, mcp: true },
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      expect(ctx.registerTool).not.toHaveBeenCalled();
    });

    it('does not register a flow with mcp:true but no httpEndpoints, and logs a warning', async () => {
      const flow = makeFlowInfo({
        id: 'flow-no-http',
        label: 'My MCP Flow',
        httpEndpoints: [] as { path: string; method: string }[],
        metadata: { ...makeFlowInfo().metadata, flowId: 'flow-no-http', mcp: true },
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      expect(ctx.registerTool).not.toHaveBeenCalled();
      expect(ctx.logger.warn).toHaveBeenCalled();
    });

    it('does not register a flow with neither mcp flag nor mcp- label', async () => {
      const flow = makeFlowInfo({
        httpEndpoints: [{ path: '/some-endpoint', method: 'get' }],
        metadata: { ...makeFlowInfo().metadata, mcp: false },
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      expect(ctx.registerTool).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T007: slugifyLabel — tested indirectly via scanAndRegister observing tool ID
  // ──────────────────────────────────────────────────────────────────────────

  describe('slugifyLabel (via scanAndRegister tool ID)', () => {
    /** Helper: register one eligible flow with the given label, return the tool ID arg */
    async function getRegisteredId(label: string): Promise<string> {
      const flow = makeEligibleFlow({ id: `flow-${label}`, label });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);
      ctx.registerTool.mockClear();
      await svc.scanAndRegister();
      const call = ctx.registerTool.mock.calls[0];
      if (!call) throw new Error(`registerTool was not called for label: "${label}"`);
      return call[0].id as string;
    }

    it('lowercases and hyphenates a normal label: "My Flow Name" → "nodered:my-flow-name"', async () => {
      const id = await getRegisteredId('My Flow Name');
      expect(id).toBe('nodered:my-flow-name');
    });

    it('preserves an already-slugified mcp- label: "mcp-check-sol-price" → "nodered:mcp-check-sol-price"', async () => {
      const id = await getRegisteredId('mcp-check-sol-price');
      expect(id).toBe('nodered:mcp-check-sol-price');
    });

    it('strips symbols: "Flow With  Spaces & Symbols!" → "nodered:flow-with-spaces-symbols"', async () => {
      const id = await getRegisteredId('Flow With  Spaces & Symbols!');
      expect(id).toBe('nodered:flow-with-spaces-symbols');
    });

    it('collapses consecutive hyphens: "flow--name" → "nodered:flow-name"', async () => {
      const id = await getRegisteredId('flow--name');
      expect(id).toBe('nodered:flow-name');
    });

    it('trims leading/trailing hyphens: "--my-flow--" → "nodered:my-flow"', async () => {
      const id = await getRegisteredId('--my-flow--');
      expect(id).toBe('nodered:my-flow');
    });

    it('caps slug part at 64 chars and logs a warning for very long labels', async () => {
      const longLabel = 'a'.repeat(100);
      ctx.logger.warn.mockClear();
      const id = await getRegisteredId(longLabel);

      const slugPart = id.replace('nodered:', '');
      expect(slugPart.length).toBeLessThanOrEqual(64);
      expect(ctx.logger.warn).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T008: buildSchema — tested indirectly via scanAndRegister observing parameters field
  // ──────────────────────────────────────────────────────────────────────────

  describe('buildSchema (via scanAndRegister tool parameters)', () => {
    /** Helper: register one eligible flow with the given params, return the Zod schema */
    async function getSchema(params?: Record<string, ParamDescriptor>) {
      const flow = makeEligibleFlow({
        metadata: {
          ...makeEligibleFlow().metadata,
          params,
        },
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);
      ctx.registerTool.mockClear();
      await svc.scanAndRegister();
      const call = ctx.registerTool.mock.calls[0];
      if (!call) throw new Error('registerTool was not called');
      return call[0].parameters;
    }

    it('uses fallback schema with optional input field when params is undefined', async () => {
      const schema = await getSchema(undefined);
      expect(schema.safeParse({}).success).toBe(true);
      expect(schema.safeParse({ input: 'hello' }).success).toBe(true);
      // Verify the shape has an 'input' key
      const shape = schema.shape ?? schema._def?.shape?.();
      expect(shape).toHaveProperty('input');
    });

    it('uses fallback schema with optional input field when params is an empty object', async () => {
      const schema = await getSchema({});
      expect(schema.safeParse({}).success).toBe(true);
      expect(schema.safeParse({ input: 'hello' }).success).toBe(true);
    });

    it('validates required string param: accepts { name: "test" }, rejects {}', async () => {
      const schema = await getSchema({
        name: { type: 'string', required: true },
      });

      expect(schema.safeParse({ name: 'test' }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
    });

    it('validates optional number param: accepts { count: 5 } and {}, rejects { count: "abc" }', async () => {
      const schema = await getSchema({
        count: { type: 'number' },
      });

      expect(schema.safeParse({ count: 5 }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(true);
      expect(schema.safeParse({ count: 'abc' }).success).toBe(false);
    });

    it('validates optional boolean param: accepts { flag: true }, coerces "true"', async () => {
      const schema = await getSchema({
        flag: { type: 'boolean' },
      });

      expect(schema.safeParse({ flag: true }).success).toBe(true);
      // Zod z.coerce.boolean() coerces strings
      expect(schema.safeParse({ flag: 'true' }).success).toBe(true);
    });

    it('preserves description metadata on string field', async () => {
      const schema = await getSchema({
        name: { type: 'string', description: 'The name' },
      });

      // Schema should parse successfully and the description should be present
      // (accessible via Zod's shape introspection)
      const result = schema.safeParse({ name: 'hello' });
      expect(result.success).toBe(true);
      // Verify description is in the schema definition (implementation-level check)
      const shape = schema.shape ?? schema._def?.shape?.();
      if (shape?.name) {
        const desc = shape.name.description ?? shape.name._def?.description;
        expect(desc).toBe('The name');
      }
    });

    it('handles mixed required/optional params: required fails on missing, optional passes', async () => {
      const schema = await getSchema({
        requiredField: { type: 'string', required: true },
        optionalField: { type: 'number' },
      });

      // Optional field missing is fine
      expect(schema.safeParse({ requiredField: 'value' }).success).toBe(true);
      // Both present is fine
      expect(schema.safeParse({ requiredField: 'value', optionalField: 42 }).success).toBe(true);
      // Missing required field fails
      expect(schema.safeParse({ optionalField: 42 }).success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T009: scanAndRegister — core orchestration tests
  // ──────────────────────────────────────────────────────────────────────────

  describe('scanAndRegister', () => {
    it('registers all eligible flows from a mixed list (2 eligible, 1 not)', async () => {
      const eligible1 = makeEligibleFlow({ id: 'flow-a', label: 'Flow A' });
      const eligible2 = makeEligibleFlow({ id: 'flow-b', label: 'Flow B' });
      const ineligible = makeFlowInfo({
        id: 'flow-c',
        label: 'Plain Flow',
        httpEndpoints: [] as { path: string; method: string }[],
        metadata: { ...makeFlowInfo().metadata, flowId: 'flow-c', mcp: false },
      });

      const fm = makeFlowManager([eligible1, eligible2, ineligible]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      expect(ctx.registerTool).toHaveBeenCalledTimes(2);
    });

    it('registers zero tools when there are no flows', async () => {
      const fm = makeFlowManager([]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      expect(ctx.registerTool).not.toHaveBeenCalled();
    });

    it('logs an error and does not crash when FlowManager.listFlows() throws', async () => {
      const fm = makeFlowManager();
      fm.listFlows.mockRejectedValue(new Error('Node-RED unavailable'));
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await expect(svc.scanAndRegister()).resolves.toBeUndefined();
      expect(ctx.logger.error).toHaveBeenCalled();
      expect(ctx.registerTool).not.toHaveBeenCalled();
    });

    it('skips duplicate slugs (two flows with the same label) and logs a warning for the second', async () => {
      // Both flows have same label → same slug → second is a duplicate
      const flow1 = makeEligibleFlow({ id: 'flow-dup-1', label: 'Duplicate Flow' });
      const flow2 = makeEligibleFlow({ id: 'flow-dup-2', label: 'Duplicate Flow' });
      const fm = makeFlowManager([flow1, flow2]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      // Only the first should be registered; second is skipped
      expect(ctx.registerTool).toHaveBeenCalledOnce();
      expect(ctx.logger.warn).toHaveBeenCalled();
    });

    it('registers a tool with the correct id, description, and pluginId fields', async () => {
      const flow = makeEligibleFlow({
        id: 'flow-sol',
        label: 'Check Sol Price',
        metadata: {
          ...makeEligibleFlow().metadata,
          flowId: 'flow-sol',
          description: 'Fetches the current Solana price',
        },
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      const tool = ctx.registerTool.mock.calls[0][0];
      expect(tool.id).toBe('nodered:check-sol-price');
      expect(tool.description).toBeTruthy();
      expect(tool.pluginId).toMatch(/nodered/i);
    });

    it('registered tool execute function calls the flow HTTP endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
        json: () => Promise.resolve({ result: 'ok' }),
        text: () => Promise.resolve('{"result":"ok"}'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const flow = makeEligibleFlow({
        id: 'flow-exec',
        label: 'Execute Me',
        httpEndpoints: [{ path: '/execute-me', method: 'post' }],
        metadata: {
          ...makeEligibleFlow().metadata,
          flowId: 'flow-exec',
        },
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      const tool = ctx.registerTool.mock.calls[0][0];
      expect(typeof tool.execute).toBe('function');

      // Actually call execute and assert the HTTP request
      const result = await tool.execute({}) as any;
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/execute-me');
      expect((init as RequestInit).method).toBe('POST');
      expect(result.ok).toBe(true);

      vi.unstubAllGlobals();
    });

    it('getRegisteredToolIds returns IDs of all currently registered tools', async () => {
      const eligible1 = makeEligibleFlow({ id: 'flow-x', label: 'Flow X' });
      const eligible2 = makeEligibleFlow({ id: 'flow-y', label: 'Flow Y' });
      const fm = makeFlowManager([eligible1, eligible2]);
      const svc = new McpBridgeService(fm, eventBus, ctx);

      await svc.scanAndRegister();

      const ids = svc.getRegisteredToolIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('nodered:flow-x');
      expect(ids).toContain('nodered:flow-y');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T018: execute() handler — HTTP dispatch (US2)
  // ──────────────────────────────────────────────────────────────────────────

  describe('execute() handler (US2)', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function makeJsonResponse(body: unknown, status = 200) {
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      });
    }

    async function getExecuteFn(
      overrides: Partial<FlowInfo> = {},
      metaOverrides: Partial<FlowMetadata> = {},
    ) {
      const flow = makeEligibleFlow({
        id: 'flow-exec',
        label: 'Execute Me',
        httpEndpoints: [{ path: '/execute-me', method: 'post' }],
        metadata: {
          ...makeEligibleFlow().metadata,
          flowId: 'flow-exec',
          ...metaOverrides,
        },
        ...overrides,
      });
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, eventBus, ctx);
      ctx.registerTool.mockClear();
      await svc.scanAndRegister();
      const tool = ctx.registerTool.mock.calls[0]?.[0];
      if (!tool) throw new Error('registerTool was not called');
      return tool.execute as (args: Record<string, unknown>) => Promise<unknown>;
    }

    it('sends POST request to the correct endpoint URL for POST flows', async () => {
      mockFetch.mockReturnValue(makeJsonResponse({ result: 'ok' }));
      const execute = await getExecuteFn();

      await execute({ name: 'test' });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/execute-me');
      expect((init as RequestInit).method?.toUpperCase()).toBe('POST');
    });

    it('sends args as JSON body for POST requests', async () => {
      mockFetch.mockReturnValue(makeJsonResponse({ result: 'ok' }));
      const execute = await getExecuteFn();

      await execute({ name: 'hello', count: 3 });

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toMatchObject({ name: 'hello', count: 3 });
    });

    it('returns structured result with output on successful JSON response', async () => {
      mockFetch.mockReturnValue(makeJsonResponse({ price: 150 }));
      const execute = await getExecuteFn();

      const result = await execute({}) as any;

      expect(result.ok).toBe(true);
      expect(result.output).toMatchObject({ price: 150 });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // T019: error handling
    // ──────────────────────────────────────────────────────────────────────────

    it('returns structured error on HTTP 4xx response', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: false,
        status: 404,
        headers: { get: () => null },
        text: () => Promise.resolve('Not Found'),
        json: () => Promise.reject(new Error('not json')),
      }));
      const execute = await getExecuteFn();

      const result = await execute({}) as any;

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBeTruthy();
      expect(String(result.error?.message)).toContain('404');
    });

    it('returns structured error on HTTP 5xx response', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: () => Promise.resolve('Internal Server Error'),
        json: () => Promise.reject(new Error('not json')),
      }));
      const execute = await getExecuteFn();

      const result = await execute({}) as any;

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBeTruthy();
    });

    it('returns raw text fallback when response is not valid JSON', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('plain text result'),
        json: () => Promise.reject(new SyntaxError('not json')),
      }));
      const execute = await getExecuteFn();

      const result = await execute({}) as any;

      expect(result.ok).toBe(true);
      expect(result.output).toBe('plain text result');
    });

    it('returns timeout error when fetch times out', async () => {
      // Simulate an AbortError (as thrown by fetch when AbortSignal fires).
      // Use a plain Error with name='AbortError' since DOMException may not exist in all runtimes.
      const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
      mockFetch.mockReturnValue(Promise.reject(abortError));
      const execute = await getExecuteFn();

      const result = await execute({}) as any;

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // T020: custom timeout from FlowMetadata.timeout
    // ──────────────────────────────────────────────────────────────────────────

    it('respects custom timeout from FlowMetadata.timeout (signal passed to fetch)', async () => {
      mockFetch.mockReturnValue(makeJsonResponse({ ok: true }));
      // timeout: 5000 (5s custom instead of default 30s)
      const execute = await getExecuteFn({}, { timeout: 5000 });

      await execute({});

      const [, init] = mockFetch.mock.calls[0];
      // The signal should be an AbortSignal (from AbortController)
      expect((init as RequestInit).signal).toBeDefined();
    });

    it('default timeout of 30s is used when FlowMetadata.timeout is not set', async () => {
      mockFetch.mockReturnValue(makeJsonResponse({ ok: true }));
      const execute = await getExecuteFn({}, { timeout: undefined });

      await execute({});

      const [, init] = mockFetch.mock.calls[0];
      expect((init as RequestInit).signal).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T010: integration — `nodered:ready` event triggers full scan + registration
  // ──────────────────────────────────────────────────────────────────────────

  describe('integration: nodered:ready', () => {
    /**
     * Helper: build a service using a functional event bus and call init().
     * Returns the service and the functional event bus so tests can publish events.
     */
    async function makeInitializedService(flows: FlowInfo[]) {
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager(flows);
      // ctx is reset in beforeEach — safe to reuse
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      return { svc, feBus };
    }

    it('publishing nodered:ready causes registerTool to be called for each eligible flow', async () => {
      const eligible1 = makeEligibleFlow({ id: 'flow-r1', label: 'Ready Flow One' });
      const eligible2 = makeEligibleFlow({ id: 'flow-r2', label: 'Ready Flow Two' });

      const { feBus } = await makeInitializedService([eligible1, eligible2]);

      feBus.publish('nodered:ready', { port: 1880 });

      // scanAndRegister() is async; the event handler fires it with `void`.
      // Flush the microtask queue before asserting.
      await new Promise(r => setTimeout(r, 10));
      expect(ctx.registerTool).toHaveBeenCalledTimes(2);
    });

    it('publishing nodered:ready with only ineligible flows registers no tools', async () => {
      const ineligible = makeFlowInfo({
        id: 'flow-plain',
        label: 'Plain Flow',
        httpEndpoints: [] as { path: string; method: string }[],
        metadata: { ...makeFlowInfo().metadata, flowId: 'flow-plain', mcp: false },
      });

      const { feBus } = await makeInitializedService([ineligible]);

      feBus.publish('nodered:ready', { port: 1880 });

      await new Promise(r => setTimeout(r, 10));
      expect(ctx.registerTool).not.toHaveBeenCalled();
    });

    it('publishing nodered:ready with no flows at all registers no tools', async () => {
      const { feBus } = await makeInitializedService([]);

      feBus.publish('nodered:ready', { port: 1880 });

      await new Promise(r => setTimeout(r, 10));
      expect(ctx.registerTool).not.toHaveBeenCalled();
    });

    it('service subscribes to nodered:ready during init()', async () => {
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([]);
      const svc = new McpBridgeService(fm, feBus, ctx);

      await svc.init();

      // subscribe must have been called for 'nodered:ready'
      const subscribedTypes = feBus.subscribe.mock.calls.map((c: any[]) => c[0]);
      expect(subscribedTypes).toContain('nodered:ready');
    });

    it('eligible flows appear in getRegisteredToolIds after nodered:ready event', async () => {
      const eligible = makeEligibleFlow({ id: 'flow-evt', label: 'Event Flow' });

      const { feBus, svc } = await makeInitializedService([eligible]);

      feBus.publish('nodered:ready', { port: 1880 });

      await new Promise(r => setTimeout(r, 10));
      const ids = svc.getRegisteredToolIds();
      expect(ids).toContain('nodered:event-flow');
    });

    it('only eligible flows are registered when list is mixed', async () => {
      const eligible = makeEligibleFlow({ id: 'flow-mix-e', label: 'Mix Eligible' });
      const ineligible = makeFlowInfo({
        id: 'flow-mix-i',
        label: 'Mix Ineligible',
        httpEndpoints: [] as { path: string; method: string }[],
        metadata: { ...makeFlowInfo().metadata, flowId: 'flow-mix-i', mcp: false },
      });

      const { feBus } = await makeInitializedService([eligible, ineligible]);

      feBus.publish('nodered:ready', { port: 1880 });

      await new Promise(r => setTimeout(r, 10));
      expect(ctx.registerTool).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T026: integration — nodered:ready triggers full teardown + re-scan (FR-008)
  // ──────────────────────────────────────────────────────────────────────────

  describe('nodered:ready full teardown + re-scan (FR-008)', () => {
    it('unregisters all previously registered tools before re-scanning when nodered:ready fires again', async () => {
      // Arrange: first scan registers two tools via a direct scanAndRegister() call
      const flow1 = makeEligibleFlow({ id: 'flow-pre-1', label: 'Pre Flow One' });
      const flow2 = makeEligibleFlow({ id: 'flow-pre-2', label: 'Pre Flow Two' });

      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([flow1, flow2]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();

      // Simulate the initial scan (e.g., triggered by a prior nodered:ready or explicit call)
      await svc.scanAndRegister();
      // Two tools should now be registered
      expect(svc.getRegisteredToolIds()).toHaveLength(2);
      const firstScanToolIds = [...svc.getRegisteredToolIds()];

      // Reset registerTool spy so we can count calls from the second event
      ctx.registerTool.mockClear();
      ctx.unregisterTool.mockClear();

      // Act: publish nodered:ready — this should trigger teardownAll() then scanAndRegister()
      feBus.publish('nodered:ready', { port: 1880 });

      // Flush the microtask queue
      await new Promise(r => setTimeout(r, 20));

      // Assert: unregisterTool was called for each previously registered tool
      expect(ctx.unregisterTool).toHaveBeenCalledTimes(2);
      expect(ctx.unregisterTool).toHaveBeenCalledWith(firstScanToolIds[0]);
      expect(ctx.unregisterTool).toHaveBeenCalledWith(firstScanToolIds[1]);

      // Assert: scanAndRegister ran again — both tools are re-registered
      expect(ctx.registerTool).toHaveBeenCalledTimes(2);

      // Assert: internal Map reflects fresh state (same IDs since flows are the same)
      expect(svc.getRegisteredToolIds()).toHaveLength(2);
    });

    it('teardownAll clears internal state so re-scan can re-register the same tool IDs without duplicate warnings', async () => {
      const flow = makeEligibleFlow({ id: 'flow-unique', label: 'Unique Flow' });

      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();

      // Initial scan
      await svc.scanAndRegister();
      expect(svc.getRegisteredToolIds()).toHaveLength(1);

      // No duplicate warnings yet
      ctx.logger.warn.mockClear();

      // Trigger re-scan via event
      feBus.publish('nodered:ready', { port: 1880 });
      await new Promise(r => setTimeout(r, 20));

      // If teardownAll cleared the Map, the same flow can be re-registered without a "duplicate" warning
      expect(ctx.logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('duplicate'),
        expect.anything(),
      );
      // And the tool is still registered exactly once
      expect(svc.getRegisteredToolIds()).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T024: handleFlowUpdated — flow:updated event handling (US3)
  // ──────────────────────────────────────────────────────────────────────────

  describe('handleFlowUpdated', () => {
    /**
     * Helper: build a service with one pre-registered eligible flow,
     * using a functional event bus so tests can publish flow:updated events.
     */
    async function makeServiceWithRegisteredFlow(initialFlow: FlowInfo) {
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([initialFlow]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      await svc.scanAndRegister();
      return { svc, feBus, fm };
    }

    it('flow endpoint changes → old tool unregistered, new tool registered with same id', async () => {
      const original = makeEligibleFlow({
        id: 'flow-upd',
        label: 'Update Me',
        httpEndpoints: [{ path: '/update-me', method: 'get' }],
      });
      const { svc, feBus } = await makeServiceWithRegisteredFlow(original);

      ctx.registerTool.mockClear();
      ctx.unregisterTool.mockClear();

      const updated = makeEligibleFlow({
        id: 'flow-upd',
        label: 'Update Me',
        httpEndpoints: [{ path: '/update-me-v2', method: 'get' }], // endpoint changed
      });

      feBus.publish('flow:updated', { flow: updated });
      await new Promise(r => setTimeout(r, 10));

      // Old tool unregistered, new tool registered
      expect(ctx.unregisterTool).toHaveBeenCalledWith('nodered:update-me');
      expect(ctx.registerTool).toHaveBeenCalledOnce();
      const newTool = ctx.registerTool.mock.calls[0][0];
      expect(newTool.id).toBe('nodered:update-me');
    });

    it('flow becomes ineligible → tool removed from registry and from internal Map', async () => {
      const original = makeEligibleFlow({
        id: 'flow-upd',
        label: 'Update Me',
        httpEndpoints: [{ path: '/update-me', method: 'get' }],
      });
      const { svc, feBus } = await makeServiceWithRegisteredFlow(original);

      ctx.registerTool.mockClear();
      ctx.unregisterTool.mockClear();

      // Flow no longer qualifies — mcp:false, no mcp- prefix
      const nowIneligible = makeFlowInfo({
        id: 'flow-upd',
        label: 'Update Me',
        httpEndpoints: [{ path: '/update-me', method: 'get' }],
        metadata: { ...makeFlowInfo().metadata, flowId: 'flow-upd', mcp: false },
      });

      feBus.publish('flow:updated', { flow: nowIneligible });
      await new Promise(r => setTimeout(r, 10));

      expect(ctx.unregisterTool).toHaveBeenCalledWith('nodered:update-me');
      expect(ctx.registerTool).not.toHaveBeenCalled();
      expect(svc.getRegisteredToolIds()).not.toContain('nodered:update-me');
    });

    it('previously ineligible flow becomes eligible → tool added to registry', async () => {
      const ineligible = makeFlowInfo({
        id: 'flow-new',
        label: 'New Eligible',
        httpEndpoints: [{ path: '/new-eligible', method: 'get' }],
        metadata: { ...makeFlowInfo().metadata, flowId: 'flow-new', mcp: false },
      });

      // Start with the ineligible flow — nothing registered after scan
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([ineligible]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      await svc.scanAndRegister();

      expect(svc.getRegisteredToolIds()).not.toContain('nodered:new-eligible');
      ctx.registerTool.mockClear();
      ctx.unregisterTool.mockClear();

      // Flow now becomes eligible
      const nowEligible = makeEligibleFlow({
        id: 'flow-new',
        label: 'New Eligible',
        httpEndpoints: [{ path: '/new-eligible', method: 'get' }],
      });

      feBus.publish('flow:updated', { flow: nowEligible });
      await new Promise(r => setTimeout(r, 10));

      expect(ctx.registerTool).toHaveBeenCalledOnce();
      expect(ctx.unregisterTool).not.toHaveBeenCalled();
      expect(svc.getRegisteredToolIds()).toContain('nodered:new-eligible');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T031: prompt:redraw emitted after tool registration/unregistration (US4)
  // ──────────────────────────────────────────────────────────────────────────

  describe('prompt:redraw (US4)', () => {
    it('emits prompt:redraw after registerFlowTool via scanAndRegister', async () => {
      const flow = makeEligibleFlow({ id: 'flow-redraw', label: 'Redraw Flow' });
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, feBus, ctx);

      await svc.scanAndRegister();

      const publishedTypes = feBus.publish.mock.calls.map((c: any[]) => c[0]);
      expect(publishedTypes).toContain('prompt:redraw');
    });

    it('emits prompt:redraw after handleFlowDeleted removes a registered tool', async () => {
      const flow = makeEligibleFlow({ id: 'flow-del-redraw', label: 'Del Redraw Flow' });
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      await svc.scanAndRegister();

      feBus.publish.mockClear();

      feBus.publish('flow:deleted', { flowId: 'flow-del-redraw' });
      await new Promise(r => setTimeout(r, 10));

      const publishedTypes = feBus.publish.mock.calls.map((c: any[]) => c[0]);
      expect(publishedTypes).toContain('prompt:redraw');
    });

    it('emits prompt:redraw after teardownAll + scanAndRegister cycle (nodered:ready)', async () => {
      const flow = makeEligibleFlow({ id: 'flow-cycle', label: 'Cycle Flow' });
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      await svc.scanAndRegister();

      feBus.publish.mockClear();

      feBus.publish('nodered:ready', { port: 1880 });
      await new Promise(r => setTimeout(r, 20));

      const publishedTypes = feBus.publish.mock.calls.map((c: any[]) => c[0]);
      expect(publishedTypes).toContain('prompt:redraw');
    });

    it('does NOT emit prompt:redraw after scanAndRegister when no tools are registered', async () => {
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([]);
      const svc = new McpBridgeService(fm, feBus, ctx);

      await svc.scanAndRegister();

      const publishedTypes = feBus.publish.mock.calls.map((c: any[]) => c[0]);
      expect(publishedTypes).not.toContain('prompt:redraw');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T025: handleFlowDeleted — flow:deleted event handling (US3)
  // ──────────────────────────────────────────────────────────────────────────

  describe('handleFlowDeleted', () => {
    it('registered flow deleted → unregisterTool called and tool removed from internal Map', async () => {
      const flow = makeEligibleFlow({
        id: 'flow-del',
        label: 'Delete Me',
        httpEndpoints: [{ path: '/delete-me', method: 'get' }],
      });

      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([flow]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      await svc.scanAndRegister();

      expect(svc.getRegisteredToolIds()).toContain('nodered:delete-me');
      ctx.unregisterTool.mockClear();

      feBus.publish('flow:deleted', { flowId: 'flow-del' });
      await new Promise(r => setTimeout(r, 10));

      expect(ctx.unregisterTool).toHaveBeenCalledWith('nodered:delete-me');
      expect(svc.getRegisteredToolIds()).not.toContain('nodered:delete-me');
    });

    it('unknown flow deleted → no-op (no error, unregisterTool not called)', async () => {
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      await svc.scanAndRegister();

      ctx.unregisterTool.mockClear();

      // Publish deletion for a flow that was never registered
      feBus.publish('flow:deleted', { flowId: 'flow-does-not-exist' });
      await new Promise(r => setTimeout(r, 10));

      expect(ctx.unregisterTool).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // T047: flow:created event → tool registration
  // ──────────────────────────────────────────────────────────────────────────

  describe('flow:created event', () => {
    it('newly created eligible flow is registered as a tool', async () => {
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([]); // no flows initially
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();
      await svc.scanAndRegister();

      expect(ctx.registerTool).not.toHaveBeenCalled();
      ctx.registerTool.mockClear();

      const newFlow = makeEligibleFlow({
        id: 'flow-new-created',
        label: 'New Created Flow',
        httpEndpoints: [{ path: '/new-created', method: 'post' }],
      });

      feBus.publish('flow:created', { flow: newFlow });
      await new Promise(r => setTimeout(r, 10));

      expect(ctx.registerTool).toHaveBeenCalledOnce();
      expect(svc.getRegisteredToolIds()).toContain('nodered:new-created-flow');
    });

    it('newly created ineligible flow is not registered', async () => {
      const feBus = makeFunctionalEventBus();
      const fm = makeFlowManager([]);
      const svc = new McpBridgeService(fm, feBus, ctx);
      await svc.init();

      ctx.registerTool.mockClear();

      const ineligibleFlow = makeFlowInfo({
        id: 'flow-ineligible-new',
        label: 'Plain New Flow',
        httpEndpoints: [{ path: '/plain', method: 'get' }],
        metadata: { ...makeFlowInfo().metadata, flowId: 'flow-ineligible-new', mcp: false },
      });

      feBus.publish('flow:created', { flow: ineligibleFlow });
      await new Promise(r => setTimeout(r, 10));

      expect(ctx.registerTool).not.toHaveBeenCalled();
    });
  });
});
