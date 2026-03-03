/**
 * T015 — PID file read/write/removal unit tests for NodeRedManager
 *
 * These tests are written FIRST (TDD). T016 will implement the actual PID file
 * persistence. Tests are expected to FAIL (red) until T016 is implemented.
 *
 * PID file path: <homePath>/nodered/nodered.pid
 *
 * Behaviors under test:
 *   1. PID file written with `{pid}\n` when start() spawns a process
 *   2. PID file removed when stop() completes successfully
 *   3. PID file removed when handleProcessExit() detects an unintentional exit (crash)
 *   4. PID file read on init() when HTTP probe succeeds (stale process adoption)
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readFileSync: vi.fn(),
  promises: {
    open: vi.fn().mockResolvedValue({ appendFile: vi.fn(), close: vi.fn() }),
    appendFile: vi.fn(),
  },
}));

import * as fs from 'node:fs';
import { NodeRedManager } from '../../../../src/plugins/nodered/services/NodeRedManager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noopEventBus() {
  return { publish: vi.fn() };
}

/** Build a Bun.spawn mock. whichNodeExitCode controls the `which node` check. */
function makeBunSpawnMock(whichNodeExitCode: number, processExitedPromise?: Promise<number>) {
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
    // Node-RED process spawn
    return {
      exited: processExitedPromise ?? new Promise(() => {}), // never resolves by default
      pid: 12345,
      stdout: null,
      stderr: null,
      kill: vi.fn(),
    };
  });
}

function makeBunFileMock(configExists = false, configText = '') {
  return vi.fn(() => ({
    exists: () => Promise.resolve(configExists),
    text: () => Promise.resolve(configText),
  }));
}

function setupBun(
  whichNodeExitCode: number,
  processExitedPromise?: Promise<number>,
  configExists = false,
  configText = '',
) {
  vi.stubGlobal('Bun', {
    spawn: makeBunSpawnMock(whichNodeExitCode, processExitedPromise),
    file: makeBunFileMock(configExists, configText),
    write: vi.fn().mockResolvedValue(undefined),
  });
}

/** Make fs.existsSync return true for any path containing the given substring. */
function mockExistsSyncAllExcept(missingSubstring: string) {
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    return !String(p).includes(missingSubstring);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NodeRedManager — PID file (T015)', () => {
  let homePath: string;
  let eventBus: ReturnType<typeof noopEventBus>;

  beforeEach(async () => {
    homePath = await mkdtemp(join(tmpdir(), 'slashbot-pid-test-'));
    eventBus = noopEventBus();
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
    // Restore fs.promises.open after resetAllMocks (needed by attachLogHandlers)
    vi.mocked(fs.promises.open).mockResolvedValue({ appendFile: vi.fn(), close: vi.fn() } as any);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    await rm(homePath, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // 1. PID file WRITTEN on start()
  // -------------------------------------------------------------------------

  describe('start() — PID file write', () => {
    test('T015-1a: writes {pid}\\n to nodered.pid after spawning process', async () => {
      setupBun(0); // Node.js found, process never exits
      // node-red binary present, no HTTP response (port closed) → stopped state after init
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('nodered.pid')) return false;
        return true;
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();
      expect(manager.getState()).toBe('stopped');

      await manager.start();

      const expectedPidPath = join(homePath, 'nodered', 'nodered.pid');
      expect(fs.writeFileSync).toHaveBeenCalledWith(expectedPidPath, '12345\n', { mode: 0o600 });
    });

    test('T015-1b: writes {pid}\\n to nodered.pid for a freshly spawned process', async () => {
      setupBun(0);

      // node-red binary present, no HTTP response (port closed) → stopped state after init
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        // userDir and binary exist, PID file does NOT exist yet
        if (String(p).includes('nodered.pid')) return false;
        return true;
      });

      // fetch fails (no stale process)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();

      expect(manager.getState()).toBe('stopped');

      // Trigger start
      const result = await manager.start();
      expect(result.success).toBe(true);

      const expectedPidPath = join(homePath, 'nodered', 'nodered.pid');
      expect(fs.writeFileSync).toHaveBeenCalledWith(expectedPidPath, '12345\n', { mode: 0o600 });
    });

    test('T015-1c: PID written corresponds to the spawned process PID', async () => {
      setupBun(0);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('nodered.pid')) return false;
        return true;
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();
      await manager.start();

      // The mock process pid is 12345
      const writeFileSync = vi.mocked(fs.writeFileSync);
      const pidCall = writeFileSync.mock.calls.find(([p]) =>
        String(p).endsWith('nodered.pid'),
      );
      expect(pidCall).toBeDefined();
      expect(pidCall![1]).toBe('12345\n');
    });
  });

  // -------------------------------------------------------------------------
  // 2. PID file REMOVED on stop()
  // -------------------------------------------------------------------------

  describe('stop() — PID file removal', () => {
    test('T015-2a: removes nodered.pid when stop() completes', async () => {
      // Create a process that we can resolve manually on kill
      let resolveExit!: (code: number) => void;
      const exitedPromise = new Promise<number>((resolve) => {
        resolveExit = resolve;
      });

      setupBun(0, exitedPromise);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('nodered.pid')) return true; // PID file exists
        return true;
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();
      await manager.start();

      // Resolve exit so stop() can complete
      resolveExit(0);
      await manager.stop();

      const expectedPidPath = join(homePath, 'nodered', 'nodered.pid');
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPidPath);
    });

    test('T015-2b: does not throw if PID file does not exist during stop()', async () => {
      let resolveExit!: (code: number) => void;
      const exitedPromise = new Promise<number>((resolve) => {
        resolveExit = resolve;
      });

      setupBun(0, exitedPromise);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('nodered.pid')) return false; // PID file absent
        return true;
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();
      await manager.start();

      resolveExit(0);
      // Should not throw even if file is missing
      await expect(manager.stop()).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 3. PID file REMOVED on crash (handleProcessExit with intentionalStop=false)
  // -------------------------------------------------------------------------

  describe('handleProcessExit() — PID file removal on crash', () => {
    test('T015-3a: removes nodered.pid when process crashes (unintentional exit)', async () => {
      vi.useFakeTimers();

      let resolveExit!: (code: number) => void;
      const exitedPromise = new Promise<number>((resolve) => {
        resolveExit = resolve;
      });

      setupBun(0, exitedPromise);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('nodered.pid')) return true;
        return true;
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();
      await manager.start();

      // Simulate crash (unintentional: intentionalStop remains false)
      resolveExit(1);
      // Allow microtasks/promises to settle
      await vi.runAllTimersAsync();

      const expectedPidPath = join(homePath, 'nodered', 'nodered.pid');
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPidPath);
    });

    test('T015-3b: PID file removed BEFORE auto-restart is scheduled on crash', async () => {
      vi.useFakeTimers();

      let resolveExit!: (code: number) => void;
      const exitedPromise = new Promise<number>((resolve) => {
        resolveExit = resolve;
      });

      setupBun(0, exitedPromise);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('nodered.pid')) return true;
        return true;
      });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();
      await manager.start();

      resolveExit(1);
      await vi.runAllTimersAsync();

      const unlinkCalls = vi.mocked(fs.unlinkSync).mock.calls;
      const pidUnlinkCallIndex = unlinkCalls.findIndex(([p]) =>
        String(p).endsWith('nodered.pid'),
      );
      expect(pidUnlinkCallIndex).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. PID file READ on init() adoption (HTTP probe succeeds)
  // -------------------------------------------------------------------------

  describe('init() — PID file read on stale process adoption', () => {
    test('T015-4a: reads PID from nodered.pid and stores it in runtimeState when adopting stale process', async () => {
      setupBun(0);

      // All paths exist including PID file
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // PID file contains '12345\n'
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        if (String(p).endsWith('nodered.pid')) return '12345\n';
        return '';
      });

      // HTTP probe succeeds → adoption
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();

      expect(manager.getState()).toBe('running');

      // PID should be populated from file
      const status = manager.getStatus();
      expect(status.pid).toBe(12345);

      await (manager as any).destroy();
    });

    test('T015-4b: runtimeState.pid is null when PID file does not exist during adoption', async () => {
      setupBun(0);

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (String(p).includes('nodered.pid')) return false; // no PID file
        return true;
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();

      expect(manager.getState()).toBe('running');

      const status = manager.getStatus();
      expect(status.pid).toBeNull();

      await (manager as any).destroy();
    });

    test('T015-4c: reads PID file from correct path (<homePath>/nodered/nodered.pid)', async () => {
      setupBun(0);

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('99999\n');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      const manager = new NodeRedManager(eventBus as any, homePath);
      await manager.init();

      const expectedPidPath = join(homePath, 'nodered', 'nodered.pid');
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPidPath, 'utf8');

      await (manager as any).destroy();
    });

    test('T015-4d: handles malformed PID file content gracefully (non-numeric)', async () => {
      setupBun(0);

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        if (String(p).endsWith('nodered.pid')) return 'not-a-number\n';
        return '';
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

      const manager = new NodeRedManager(eventBus as any, homePath);
      // Should not throw
      await expect(manager.init()).resolves.not.toThrow();
      expect(manager.getState()).toBe('running');

      await (manager as any).destroy();
    });
  });
});

// ---------------------------------------------------------------------------
// T019 — Heartbeat / setup-monitor transitions setup-needed → running
// ---------------------------------------------------------------------------

describe('NodeRedManager — setup monitor (T019)', () => {
  let homePath: string;
  let eventBus: ReturnType<typeof noopEventBus>;

  beforeEach(async () => {
    homePath = await mkdtemp(join(tmpdir(), 'slashbot-setup-monitor-test-'));
    eventBus = noopEventBus();
    vi.resetAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
    vi.mocked(fs.promises.open).mockResolvedValue({ appendFile: vi.fn(), close: vi.fn() } as any);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    await rm(homePath, { recursive: true, force: true });
  });

  test('T019-1: transitions setup-needed → running when Node-RED starts responding', async () => {
    vi.useFakeTimers();

    // Node.js present, node-red binary absent → setup-needed
    vi.stubGlobal('Bun', {
      spawn: vi.fn((args: string[]) => ({
        exited: Promise.resolve(args[0] === 'which' ? 0 : 0),
        pid: 0,
        stdout: null,
        stderr: null,
        kill: vi.fn(),
      })),
      file: vi.fn(() => ({ exists: () => Promise.resolve(false), text: () => Promise.resolve('') })),
      write: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      // node-red binary missing → setup-needed
      if (String(p).includes('node_modules/node-red/red.js')) return false;
      return true;
    });

    // Initially fetch fails (node-red not yet running)
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const manager = new NodeRedManager(eventBus as any, homePath);
    await manager.init();

    expect(manager.getState()).toBe('setup-needed');

    // Simulate skill completing: node-red is now responding
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    // Advance timer past healthCheckInterval (default 30s)
    await vi.advanceTimersByTimeAsync(31_000);

    expect(manager.getState()).toBe('running');
    expect(eventBus.publish).toHaveBeenCalledWith(
      'nodered:ready',
      expect.objectContaining({ port: expect.any(Number) }),
    );

    await (manager as any).destroy();
  });

  test('T019-2: remains setup-needed when Node-RED is not yet responding', async () => {
    vi.useFakeTimers();

    vi.stubGlobal('Bun', {
      spawn: vi.fn((args: string[]) => ({
        exited: Promise.resolve(args[0] === 'which' ? 0 : 0),
        pid: 0,
        stdout: null,
        stderr: null,
        kill: vi.fn(),
      })),
      file: vi.fn(() => ({ exists: () => Promise.resolve(false), text: () => Promise.resolve('') })),
      write: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).includes('node_modules/node-red/red.js')) return false;
      return true;
    });

    // fetch always fails
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const manager = new NodeRedManager(eventBus as any, homePath);
    await manager.init();

    expect(manager.getState()).toBe('setup-needed');

    // Advance timer — should stay in setup-needed
    await vi.advanceTimersByTimeAsync(31_000);

    expect(manager.getState()).toBe('setup-needed');

    await (manager as any).destroy();
  });

  test('T019-3: setup monitor emits nodered:ready with correct port on transition', async () => {
    vi.useFakeTimers();

    vi.stubGlobal('Bun', {
      spawn: vi.fn((args: string[]) => ({
        exited: Promise.resolve(args[0] === 'which' ? 0 : 0),
        pid: 0,
        stdout: null,
        stderr: null,
        kill: vi.fn(),
      })),
      file: vi.fn(() => ({ exists: () => Promise.resolve(false), text: () => Promise.resolve('') })),
      write: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).includes('node_modules/node-red/red.js')) return false;
      return true;
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const manager = new NodeRedManager(eventBus as any, homePath);
    await manager.init();

    expect(manager.getState()).toBe('setup-needed');

    await vi.advanceTimersByTimeAsync(31_000);

    expect(manager.getState()).toBe('running');
    const readyCall = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'nodered:ready',
    );
    expect(readyCall).toBeDefined();
    expect(readyCall![1]).toMatchObject({ port: 1880 });

    await (manager as any).destroy();
  });
});
