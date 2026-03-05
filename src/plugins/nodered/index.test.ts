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
  password: {
    hash: vi.fn().mockResolvedValue('$2b$10$mockedhashvalue'),
  },
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
    registerGatewayMethod: vi.fn(),
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

  // ── /nodered config editor.username / editor.password ──────────────────

  describe('/nodered config editor commands', () => {
    let command: any;
    let stdoutChunks: string[];
    let stderrChunks: string[];
    let commandContext: any;

    beforeEach(() => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);
      command = registered.commands.find((c: any) => c.id === 'nodered');
      stdoutChunks = [];
      stderrChunks = [];
      commandContext = {
        stdout: { write: (s: string) => stdoutChunks.push(s) },
        stderr: { write: (s: string) => stderrChunks.push(s) },
      };
    });

    it('config display includes editor.username and editor.password fields', async () => {
      const exitCode = await command.execute(['config'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('editor.username:');
      expect(output).toContain('editor.password:');
      expect(exitCode).toBe(0);
    });

    it('/nodered config editor.username sets username and saves config', async () => {
      const exitCode = await command.execute(['config', 'editor.username', 'admin'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('Editor username set to "admin"');
      expect(exitCode).toBe(0);
    });

    it('/nodered config editor.password hashes and saves password', async () => {
      const exitCode = await command.execute(['config', 'editor.password', 'mysecret'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('Editor password configured');
      expect(Bun.password.hash).toHaveBeenCalledWith('mysecret', 'bcrypt');
      expect(exitCode).toBe(0);
    });

    it('/nodered config editor.username without value returns error', async () => {
      const exitCode = await command.execute(['config', 'editor.username'], commandContext);
      const output = stderrChunks.join('');
      expect(output).toContain('Usage:');
      expect(exitCode).toBe(1);
    });

    it('/nodered config editor.username rejects non-alphanumeric values', async () => {
      const exitCode = await command.execute(['config', 'editor.username', 'bad user!'], commandContext);
      const output = stderrChunks.join('');
      expect(output).toContain('alphanumeric');
      expect(exitCode).toBe(1);
    });

    it('/nodered config editor.username accepts hyphens and underscores', async () => {
      const exitCode = await command.execute(['config', 'editor.username', 'my-admin_01'], commandContext);
      expect(exitCode).toBe(0);
    });

    it('/nodered config editor.password without value returns error', async () => {
      const exitCode = await command.execute(['config', 'editor.password'], commandContext);
      const output = stderrChunks.join('');
      expect(output).toContain('Usage:');
      expect(exitCode).toBe(1);
    });

    it('unknown config key mentions editor.username and editor.password in error', async () => {
      const exitCode = await command.execute(['config', 'badkey', 'val'], commandContext);
      const output = stderrChunks.join('');
      expect(output).toContain('editor.username');
      expect(output).toContain('editor.password');
      expect(exitCode).toBe(1);
    });
  });

  // ── /nodered ui ─────────────────────────────────────────────────────

  describe('/nodered ui command', () => {
    let command: any;
    let stdoutChunks: string[];
    let stderrChunks: string[];
    let commandContext: any;
    let managerService: any;

    beforeEach(() => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);
      command = registered.commands.find((c: any) => c.id === 'nodered');
      managerService = registered.services.find((s: any) => s.id === 'nodered.manager')?.implementation;
      stdoutChunks = [];
      stderrChunks = [];
      commandContext = {
        stdout: { write: (s: string) => stdoutChunks.push(s) },
        stderr: { write: (s: string) => stderrChunks.push(s) },
      };
    });

    it('displays credential setup instructions when credentials not configured', async () => {
      // Default state: no credentials configured, getEditorState() returns 'disabled'
      const exitCode = await command.execute(['ui'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('editor.username');
      expect(output).toContain('editor.password');
      expect(exitCode).toBe(0);
    });

    it('displays specific message when only username is set (T018)', async () => {
      if (managerService) {
        await managerService.saveConfig({ editorUsername: 'admin', editorPasswordHash: undefined });
        managerService.getEditorState = () => 'disabled';
      }
      const exitCode = await command.execute(['ui'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('password');
      expect(exitCode).toBe(0);
    });

    it('displays specific message when only password is set (T018)', async () => {
      if (managerService) {
        await managerService.saveConfig({ editorUsername: undefined, editorPasswordHash: '$2b$10$mockedhash' });
        managerService.getEditorState = () => 'disabled';
      }
      const exitCode = await command.execute(['ui'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('username');
      expect(exitCode).toBe(0);
    });

    it('displays "not running" message when Node-RED is not running but credentials configured', async () => {
      // Simulate credentials configured but not running
      if (managerService) {
        await managerService.saveConfig({
          editorUsername: 'admin',
          editorPasswordHash: '$2b$10$mockedhashvalue',
        });
      }
      const exitCode = await command.execute(['ui'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('not running');
      expect(output).toContain('/nodered start');
      expect(exitCode).toBe(0);
    });

    it('displays editor URL when running and credentials configured', async () => {
      // Mock getEditorState to return 'available' and getEditorUrl to return URL
      if (managerService) {
        managerService.getEditorState = () => 'available';
        managerService.getEditorUrl = () => 'http://localhost:1880';
      }
      const exitCode = await command.execute(['ui'], commandContext);
      const output = stdoutChunks.join('');
      expect(output).toContain('http://localhost:1880');
      expect(exitCode).toBe(0);
    });
  });

  // ── Context provider ────────────────────────────────────────────────

  describe('context provider', () => {
    let managerService: any;
    let contextProvider: any;

    beforeEach(() => {
      const plugin = createNodeRedPlugin();
      plugin.setup(mockContext as any);
      managerService = registered.services.find((s: any) => s.id === 'nodered.manager')?.implementation;
      contextProvider = registered.contextProviders[0];
    });

    it('includes editor URL when editor is available', () => {
      if (managerService) {
        managerService.getState = () => 'running';
        managerService.getEditorState = () => 'available';
        managerService.getEditorUrl = () => 'http://localhost:1880';
      }
      const content = contextProvider.provide();
      expect(content).toContain('http://localhost:1880');
    });

    it('does not include editorPasswordHash in context', () => {
      if (managerService) {
        managerService.getState = () => 'running';
        managerService.getEditorState = () => 'available';
        managerService.getEditorUrl = () => 'http://localhost:1880';
      }
      const content = contextProvider.provide();
      expect(content).not.toContain('editorPasswordHash');
      expect(content).not.toContain('$2b$');
    });

    it('does not include editorUsername in context', () => {
      if (managerService) {
        managerService.getState = () => 'running';
        managerService.getEditorState = () => 'available';
        managerService.getEditorUrl = () => 'http://localhost:1880';
      }
      const content = contextProvider.provide();
      expect(content).not.toContain('editorUsername');
    });
  });
});
