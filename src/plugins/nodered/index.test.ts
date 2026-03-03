/**
 * Unit tests for the Node-RED plugin factory (slashbot3 architecture).
 *
 * Verifies that createNodeRedPlugin() returns a correct manifest and that
 * setup() registers all expected services, tools, commands, hooks, prompt
 * sections, status indicators, and context providers via the plugin context.
 *
 * Full lifecycle behaviour is tested in NodeRedManager.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Bun APIs before importing the plugin
vi.stubGlobal('Bun', {
  spawn: vi.fn(),
  write: vi.fn(),
  file: vi.fn(() => ({
    exists: () => Promise.resolve(false),
    text: () => Promise.resolve('{}'),
  })),
});
vi.stubGlobal('fetch', vi.fn());

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  chmodSync: vi.fn(),
  promises: {
    open: vi.fn().mockResolvedValue({
      appendFile: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    appendFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { createNodeRedPlugin } from './index';

describe('createNodeRedPlugin', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const mockEventBus = {
    publish: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  };

  const registered = {
    services: [] as any[],
    tools: [] as any[],
    commands: [] as any[],
    hooks: [] as any[],
    promptSections: [] as any[],
    statusIndicators: [] as any[],
    contextProviders: [] as any[],
  };

  const mockContext = {
    getService: vi.fn((id: string) => {
      if (id === 'kernel.paths') return { home: () => '/tmp/test-slashbot' };
      if (id === 'kernel.events') return mockEventBus;
      if (id === 'kernel.logger') return mockLogger;
      return undefined;
    }),
    registerService: vi.fn((s: any) => registered.services.push(s)),
    registerTool: vi.fn((t: any) => registered.tools.push(t)),
    registerCommand: vi.fn((c: any) => registered.commands.push(c)),
    registerHook: vi.fn((h: any) => registered.hooks.push(h)),
    contributePromptSection: vi.fn((p: any) => registered.promptSections.push(p)),
    contributeStatusIndicator: vi.fn((_: any) => {
      registered.statusIndicators.push(_);
      return vi.fn();
    }),
    contributeContextProvider: vi.fn((p: any) => registered.contextProviders.push(p)),
    logger: mockLogger,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registered.services.length = 0;
    registered.tools.length = 0;
    registered.commands.length = 0;
    registered.hooks.length = 0;
    registered.promptSections.length = 0;
    registered.statusIndicators.length = 0;
    registered.contextProviders.length = 0;
  });

  // ── Manifest ─────────────────────────────────────────────────────────────

  describe('manifest', () => {
    it('has the correct plugin id', () => {
      const plugin = createNodeRedPlugin();
      expect(plugin.manifest.id).toBe('slashbot.nodered');
    });

    it('has the correct name', () => {
      const plugin = createNodeRedPlugin();
      expect(plugin.manifest.name).toBe('Node-RED');
    });

    it('has a version field', () => {
      const plugin = createNodeRedPlugin();
      expect(plugin.manifest.version).toBe('1.0.0');
    });

    it('has main set to bundled', () => {
      const plugin = createNodeRedPlugin();
      expect(plugin.manifest.main).toBe('bundled');
    });
  });

  // ── setup() registrations ─────────────────────────────────────────────────

  describe('setup()', () => {
    it('registers core services including nodered.manager, nodered.flowManager, nodered.mcpBridge', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      const ids = registered.services.map((s) => s.id);
      expect(ids).toContain('nodered.manager');
      expect(ids).toContain('nodered.flowManager');
      expect(ids).toContain('nodered.mcpBridge');
    });

    it('registers exactly 9 tools', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      expect(registered.tools).toHaveLength(9);
    });

    it('registers the expected tool ids', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      const ids = registered.tools.map((t) => t.id);
      expect(ids).toContain('nodered.status');
      expect(ids).toContain('nodered.start');
      expect(ids).toContain('nodered.stop');
      expect(ids).toContain('nodered.restart');
      expect(ids).toContain('nodered.flow.list');
      expect(ids).toContain('nodered.flow.create');
      expect(ids).toContain('nodered.flow.update');
      expect(ids).toContain('nodered.flow.delete');
      expect(ids).toContain('nodered.flow.get');
    });

    it('registers exactly 1 command (nodered)', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      expect(registered.commands).toHaveLength(1);
      expect(registered.commands[0].id).toBe('nodered');
    });

    it('registers exactly 2 hooks (nodered.startup, nodered.shutdown)', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      expect(registered.hooks).toHaveLength(2);
      const ids = registered.hooks.map((h) => h.id);
      expect(ids).toContain('nodered.startup');
      expect(ids).toContain('nodered.shutdown');
    });

    it('startup hook targets the kernel startup event', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      const startup = registered.hooks.find((h) => h.id === 'nodered.startup');
      expect(startup?.domain).toBe('kernel');
      expect(startup?.event).toBe('startup');
    });

    it('shutdown hook targets the kernel shutdown event', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      const shutdown = registered.hooks.find((h) => h.id === 'nodered.shutdown');
      expect(shutdown?.domain).toBe('kernel');
      expect(shutdown?.event).toBe('shutdown');
    });

    it('contributes exactly 1 prompt section', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      expect(registered.promptSections).toHaveLength(1);
    });

    it('contributes exactly 1 status indicator', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      expect(registered.statusIndicators).toHaveLength(1);
    });

    it('contributes exactly 1 context provider', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      expect(registered.contextProviders).toHaveLength(1);
    });

    it('resolves kernel.paths, kernel.events, and kernel.logger from context', () => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);

      expect(mockContext.getService).toHaveBeenCalledWith('kernel.paths');
      expect(mockContext.getService).toHaveBeenCalledWith('kernel.events');
      expect(mockContext.getService).toHaveBeenCalledWith('kernel.logger');
    });
  });
});
