import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
  promises: {
    open: vi.fn().mockResolvedValue({ appendFile: vi.fn(), close: vi.fn() }),
    appendFile: vi.fn(),
  },
}));

import * as fs from 'node:fs';
import { NodeRedManager } from '../src/plugins/nodered/services/NodeRedManager.js';

function noopEventBus() {
  return { publish: vi.fn() };
}

function makeBunSpawnMock(whichNodeExitCode: number) {
  return vi.fn((args: string[]) => {
    if (args[0] === 'which') {
      return {
        exited: Promise.resolve(whichNodeExitCode),
        pid: 0,
        stdout: null,
        stderr: null,
        kill: vi.fn(),
      };
    }
    return {
      exited: Promise.resolve(0),
      pid: 0,
      stdout: null,
      stderr: null,
      kill: vi.fn(),
    };
  });
}

function makeBunFileMock() {
  return vi.fn(() => ({
    exists: () => Promise.resolve(false),
    text: () => Promise.resolve(''),
  }));
}

function setupBun(whichNodeExitCode: number) {
  vi.stubGlobal('Bun', {
    spawn: makeBunSpawnMock(whichNodeExitCode),
    file: makeBunFileMock(),
    write: vi.fn().mockResolvedValue(undefined),
  });
}

describe('NodeRedManager', () => {
  let homePath: string;
  let eventBus: ReturnType<typeof noopEventBus>;

  beforeEach(async () => {
    homePath = await mkdtemp(join(tmpdir(), 'slashbot-nodered-test-'));
    eventBus = noopEventBus();
    vi.resetAllMocks();
    // Default: directories exist, node-red binary missing
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    await rm(homePath, { recursive: true, force: true });
  });

  describe('getState()', () => {
    test('initial state is disabled', () => {
      const manager = new NodeRedManager(eventBus as any, homePath);
      expect(manager.getState()).toBe('disabled');
    });
  });

  describe('init() — Node.js unavailable (FR-016)', () => {
    test('T008b-fr016: when which node fails, state becomes unavailable quickly', async () => {
      setupBun(1); // which node exits 1

      const manager = new NodeRedManager(eventBus as any, homePath);
      const start = Date.now();
      await manager.init();
      const elapsed = Date.now() - start;

      expect(manager.getState()).toBe('unavailable');
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('init() — setup-needed transition (T008)', () => {
    test('T008: when Node.js present but node-red binary missing, state becomes setup-needed', async () => {
      setupBun(0); // which node exits 0 (found)

      // existsSync: userDir exists, but node-red binary does not
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.includes('node_modules/node-red/red.js')) return false;
        return true;
      });

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();

      expect(manager.getState()).toBe('setup-needed');
      expect(eventBus.publish).toHaveBeenCalledWith('nodered:setup-needed', expect.anything());
    });
  });

  describe('init() — stale process adoption (FR-011)', () => {
    test('T008b-fr011: when node-red binary exists and port responds 200, state becomes running', async () => {
      vi.useFakeTimers();
      setupBun(0); // which node exits 0

      // existsSync: all paths exist (including node-red binary)
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mockFetch);

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();

      expect(manager.getState()).toBe('running');
      expect(eventBus.publish).toHaveBeenCalledWith('nodered:ready', expect.objectContaining({ port: expect.any(Number) }));

      vi.useRealTimers();
      await (manager as any).destroy();
    });
  });

  describe('init() — idempotency (T008b)', () => {
    test('T008b-idempotency: second init() call when already initialized is a no-op', async () => {
      setupBun(0); // which node exits 0

      // node-red binary missing → setup-needed (simplest non-disabled state)
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('node_modules/node-red/red.js')) return false;
        return true;
      });

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();
      const stateAfterFirst = manager.getState();

      const spawnCallCount = (globalThis as any).Bun.spawn.mock.calls.length;

      // Second init — must be no-op
      await manager.init();
      expect(manager.getState()).toBe(stateAfterFirst);
      expect((globalThis as any).Bun.spawn.mock.calls.length).toBe(spawnCallCount);
    });
  });
});
