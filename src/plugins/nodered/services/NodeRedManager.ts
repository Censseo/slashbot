/**
 * Node-RED Process Manager
 *
 * Manages the Node-RED child process lifecycle:
 * - Configuration loading and persistence
 * - Process spawning and health monitoring
 * - State machine management (disabled/unavailable/stopped/starting/running/failed)
 * - Log capture to RingBuffer
 * - Stale process adoption
 * - Auto-restart on crash
 *
 * @see /specs/001-nodered-lifecycle/data-model.md
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { EventBus } from '@slashbot/core/kernel/event-bus.js';
import type { NodeRedState, NodeRedConfig, NodeRedStatus, NodeRedRuntimeState } from '../types';
import { RingBuffer } from './RingBuffer';
import { generateSettings } from './settings';

/**
 * Default Node-RED configuration (userDir is set in constructor based on homePath)
 */
const DEFAULT_CONFIG: NodeRedConfig = {
  enabled: true,
  port: 1880,
  userDir: '', // Set in constructor based on homePath
  healthCheckInterval: 30,
  shutdownTimeout: 10,
  maxRestartAttempts: 3,
  localhostOnly: true,
};

/**
 * Valid state transitions map
 */
const VALID_TRANSITIONS: Record<NodeRedState, NodeRedState[]> = {
  disabled: ['stopped', 'unavailable'],
  unavailable: ['stopped'],
  stopped: ['starting', 'failed', 'setup-needed'],
  'setup-needed': ['running'],
  starting: ['running', 'failed', 'stopped'],
  running: ['stopped', 'starting', 'failed'],
  failed: ['starting', 'stopped'],
};

/**
 * NodeRedManager - Lifecycle orchestrator for Node-RED
 *
 * Implements a 6-state state machine with validation, process spawning,
 * health checks, log capture, and graceful shutdown.
 */
/** Max consecutive health check failures before triggering restart */
const MAX_CONSECUTIVE_HEALTH_FAILURES = 3;

export class NodeRedManager {
  private eventBus: EventBus;
  private homePath: string;
  private config: NodeRedConfig;
  private consecutiveHealthFailures = 0;
  private runtimeState: NodeRedRuntimeState = {
    state: 'disabled',
    pid: null,
    process: null,
    startedAt: null,
    restartCount: 0,
    intentionalStop: false,
    logBuffer: new RingBuffer(200),
    healthCheckTimer: null,
    readinessPollTimer: null,
    setupMonitorTimer: null,
  };

  constructor(eventBus: EventBus, homePath: string) {
    this.eventBus = eventBus;
    this.homePath = homePath;
    this.config = {
      ...DEFAULT_CONFIG,
      userDir: path.join(homePath, 'nodered'),
    };
  }

  /**
   * Validate and transition to a new state.
   * Emits prompt:redraw event on state changes.
   */
  private setState(newState: NodeRedState): void {
    const currentState = this.runtimeState.state;
    const validNextStates = VALID_TRANSITIONS[currentState] || [];

    if (!validNextStates.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${currentState} -> ${newState}`,
      );
    }

    this.runtimeState.state = newState;
    this.eventBus.publish('prompt:redraw', {});
  }

  /**
   * Emit a Node-RED lifecycle event via EventBus.
   */
  private emitNodeRedEvent(event: { type: string; [key: string]: unknown }): void {
    const { type, ...payload } = event;
    this.eventBus.publish(type, payload as any);
  }

  /**
   * Initialize the NodeRedManager.
   * Loads config, checks Node.js availability, probes for stale process.
   */
  async init(): Promise<void> {
    // Idempotency guard - allow multiple init() calls
    if (this.runtimeState.state !== 'disabled') {
      return;
    }

    // Load config from file
    const configPath = path.join(this.homePath, 'nodered.json');
    try {
      const file = Bun.file(configPath);
      const exists = await file.exists();
      if (exists) {
        const text = await file.text();
        const loadedConfig = JSON.parse(text) as NodeRedConfig;
        this.config = { ...this.config, ...loadedConfig };
      }
      // else: keep current config (already initialized in constructor)
    } catch (error) {
      // Config file doesn't exist or is invalid - keep current config
    }

    // If disabled, stay in disabled state
    if (!this.config.enabled) {
      return;
    }

    // Check Node.js availability
    const nodeCheck = Bun.spawn(['which', 'node'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const exitCode = await nodeCheck.exited;

    if (exitCode !== 0) {
      this.setState('unavailable');
      this.emitNodeRedEvent({
        type: 'nodered:failed',
        error: 'Node.js not found. Please install Node.js to use Node-RED.',
      });
      return;
    }

    // Set state to stopped (Node.js is available, ready to start)
    this.setState('stopped');

    // Create userDir if not exists
    const resolvedUserDir = this.resolveUserDir();
    if (!fs.existsSync(resolvedUserDir)) {
      fs.mkdirSync(resolvedUserDir, { recursive: true });
    }

    // Generate settings.js eagerly during init
    const settingsPath = path.join(resolvedUserDir, 'settings.js');
    const settingsContent = generateSettings(this.config);
    try {
      await Bun.write(settingsPath, settingsContent);
    } catch (error) {
      // Non-fatal: settings.js will be re-attempted in start()
    }

    // Check if Node-RED binary exists; if not, delegate setup to skill
    const redJsPath = path.join(resolvedUserDir, 'node_modules/node-red/red.js');
    if (!fs.existsSync(redJsPath)) {
      this.runtimeState.logBuffer?.push('[slashbot] Node-RED not found — setup required.');
      this.setState('setup-needed');
      this.emitNodeRedEvent({ type: 'nodered:setup-needed' });
      this.startSetupMonitor();
      return;
    }

    // Probe for stale process
    try {
      const response = await fetch(`http://localhost:${this.config.port}/`, {
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        // Stale process detected - adopt it via proper state transitions
        this.setState('starting');  // stopped → starting
        this.setState('running');   // starting → running
        this.runtimeState.startedAt = new Date();
        // Try to read PID from file (optional; best-effort)
        try {
          const pidPath = this.pidFilePath();
          if (fs.existsSync(pidPath)) {
            const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
            if (!isNaN(pid)) this.runtimeState.pid = pid;
          }
        } catch {
          // PID file unavailable — adopt without PID
        }
        this.startHealthCheckTimer();
        this.emitNodeRedEvent({ type: 'nodered:ready', port: this.config.port });
        return;
      }
    } catch (error) {
      // No stale process - stay in stopped state
    }
  }

  /**
   * Start the Node-RED process.
   */
  async start(): Promise<{ success: boolean; message?: string; error?: string }> {
    const state = this.runtimeState.state;

    // Idempotency checks
    if (state === 'starting' || state === 'running') {
      return {
        success: true,
        message: `Node-RED is already ${state}`,
      };
    }

    // Guard checks
    if (state === 'disabled' || state === 'unavailable') {
      return {
        success: false,
        error: `Cannot start Node-RED in ${state} state`,
      };
    }

    // Reset intentional stop flag
    this.runtimeState.intentionalStop = false;

    // Refresh settings.js on each start (picks up any config changes since init)
    const resolvedUserDir = this.resolveUserDir();
    const settingsPath = path.join(resolvedUserDir, 'settings.js');
    const settingsContent = generateSettings(this.config);

    try {
      await Bun.write(settingsPath, settingsContent);
    } catch (error) {
      this.setState('failed');
      return {
        success: false,
        error: `Failed to write settings.js: ${error}`,
      };
    }

    // Transition to starting state
    this.setState('starting');

    // Spawn Node-RED process
    const redJsPath = path.join(resolvedUserDir, 'node_modules/node-red/red.js');

    try {
      const proc = Bun.spawn(
        ['node', redJsPath, '-s', settingsPath],
        {
          cwd: resolvedUserDir,
          env: {
            HOME: os.homedir(),
            NODE_PATH: process.env.NODE_PATH || '',
            PATH: process.env.PATH || '',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      this.runtimeState.process = proc;
      this.runtimeState.pid = proc.pid;

      // Write PID file
      fs.writeFileSync(this.pidFilePath(), `${proc.pid}\n`, { mode: 0o600 });

      // Attach log handlers
      this.attachLogHandlers(proc);

      // Set up process exit handler
      proc.exited.then((code: number) => {
        this.handleProcessExit(code);
      });

      // Start readiness poll
      this.startReadinessPoll();

      return {
        success: true,
        message: 'Node-RED is starting',
      };
    } catch (error) {
      this.setState('failed');
      return {
        success: false,
        error: `Failed to spawn Node-RED: ${error}`,
      };
    }
  }

  /**
   * Start readiness polling (500ms interval, max 60 attempts = 30s)
   */
  private startReadinessPoll(): void {
    let attempts = 0;
    const maxAttempts = 60;

    this.runtimeState.readinessPollTimer = setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(`http://localhost:${this.config.port}/`, {
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          // Success - transition to running
          this.clearReadinessPollTimer();
          this.setState('running');
          this.runtimeState.startedAt = new Date();
          this.runtimeState.restartCount = 0;
          this.consecutiveHealthFailures = 0;
          this.startHealthCheckTimer();
          this.emitNodeRedEvent({ type: 'nodered:ready', port: this.config.port });
        }
      } catch (error) {
        // Poll failed - continue trying
      }

      // Timeout after max attempts
      if (attempts >= maxAttempts) {
        this.clearReadinessPollTimer();
        this.setState('failed');
        if (this.runtimeState.process) {
          this.runtimeState.process.kill(9); // SIGKILL
        }
        this.emitNodeRedEvent({
          type: 'nodered:failed',
          error: 'Node-RED failed to start within 30 seconds',
        });
      }
    }, 500);
  }

  /**
   * Clear readiness poll timer
   */
  private clearReadinessPollTimer(): void {
    if (this.runtimeState.readinessPollTimer) {
      clearInterval(this.runtimeState.readinessPollTimer);
      this.runtimeState.readinessPollTimer = null;
    }
  }

  /**
   * Start health check timer
   */
  private startHealthCheckTimer(): void {
    // Clear existing timer if any
    this.clearHealthCheckTimer();

    this.runtimeState.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval * 1000);
  }

  /**
   * Perform a health check.
   * On success, resets the consecutive failure counter.
   * After MAX_CONSECUTIVE_HEALTH_FAILURES consecutive failures,
   * triggers auto-restart via the crash recovery flow.
   */
  private async performHealthCheck(): Promise<void> {
    if (this.runtimeState.state !== 'running') {
      return;
    }

    try {
      const response = await fetch(`http://localhost:${this.config.port}/`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        this.consecutiveHealthFailures = 0;
      } else {
        this.handleHealthCheckFailure();
      }
    } catch (error) {
      this.handleHealthCheckFailure();
    }
  }

  /**
   * Handle a health check failure. After N consecutive failures, kill
   * the process to trigger the crash recovery auto-restart flow.
   */
  private handleHealthCheckFailure(): void {
    this.consecutiveHealthFailures++;
    this.runtimeState.logBuffer?.push(
      `[slashbot] Health check failed (${this.consecutiveHealthFailures}/${MAX_CONSECUTIVE_HEALTH_FAILURES})`,
    );

    if (this.consecutiveHealthFailures >= MAX_CONSECUTIVE_HEALTH_FAILURES) {
      this.runtimeState.logBuffer?.push(
        `[slashbot] ${MAX_CONSECUTIVE_HEALTH_FAILURES} consecutive health check failures — triggering restart`,
      );
      this.consecutiveHealthFailures = 0;
      this.clearHealthCheckTimer();

      // Kill the unresponsive process to trigger handleProcessExit -> auto-restart
      if (this.runtimeState.process) {
        try {
          this.runtimeState.process.kill(9);
        } catch {
          // Process may already be dead
        }
      }
    }
  }

  /**
   * Clear health check timer
   */
  private clearHealthCheckTimer(): void {
    if (this.runtimeState.healthCheckTimer) {
      clearInterval(this.runtimeState.healthCheckTimer);
      this.runtimeState.healthCheckTimer = null;
    }
  }

  /**
   * Start the setup monitor: poll until Node-RED responds on its port,
   * then transition from `setup-needed` directly to `running`.
   * Called after entering `setup-needed` state.
   */
  private startSetupMonitor(): void {
    this.clearSetupMonitorTimer();

    this.runtimeState.setupMonitorTimer = setInterval(async () => {
      if (this.runtimeState.state !== 'setup-needed') {
        this.clearSetupMonitorTimer();
        return;
      }

      try {
        const response = await fetch(`http://localhost:${this.config.port}/`, {
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          this.clearSetupMonitorTimer();
          this.setState('running');
          this.runtimeState.startedAt = new Date();
          this.startHealthCheckTimer();
          this.emitNodeRedEvent({ type: 'nodered:ready', port: this.config.port });
        }
      } catch {
        // Node-RED not yet available — keep polling
      }
    }, this.config.healthCheckInterval * 1000);
  }

  /**
   * Clear the setup monitor timer.
   */
  private clearSetupMonitorTimer(): void {
    if (this.runtimeState.setupMonitorTimer) {
      clearInterval(this.runtimeState.setupMonitorTimer);
      this.runtimeState.setupMonitorTimer = null;
    }
  }

  /** Reusable TextDecoder for log stream decoding */
  private textDecoder = new TextDecoder();

  /** File handle for async log writing */
  private logFileHandle: fs.promises.FileHandle | null = null;

  /**
   * Attach log handlers to stdout/stderr
   */
  private attachLogHandlers(proc: ReturnType<typeof Bun.spawn>): void {
    // Create log file directory
    const logDir = path.join(this.homePath, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Open log file handle for async append
    const logPath = path.join(this.homePath, 'logs', 'nodered.log');
    fs.promises.open(logPath, 'a').then((handle) => {
      this.logFileHandle = handle;
    }).catch(() => {
      // Ignore log file errors
    });

    const pipeStream = (stream: ReadableStream<Uint8Array>) => {
      stream.pipeTo(
        new WritableStream({
          write: (chunk) => {
            const text = this.textDecoder.decode(chunk, { stream: true });
            const lines = text.split('\n').filter((line) => line.trim());
            for (const line of lines) {
              this.runtimeState.logBuffer?.push(line);
              this.appendToLogFile(line);
            }
          },
        }),
      );
    };

    // Capture stdout (piped via stdio config)
    if (proc.stdout && typeof proc.stdout !== 'number') {
      pipeStream(proc.stdout);
    }

    // Capture stderr (piped via stdio config)
    if (proc.stderr && typeof proc.stderr !== 'number') {
      pipeStream(proc.stderr);
    }
  }

  /**
   * Append a log line to the log file (async, non-blocking)
   */
  private appendToLogFile(line: string): void {
    const logLine = `${new Date().toISOString()} ${line}\n`;
    if (this.logFileHandle) {
      this.logFileHandle.appendFile(logLine).catch(() => {
        // Ignore log file errors
      });
    } else {
      // Fallback: async fs.appendFile if handle not yet ready
      const logPath = path.join(this.homePath, 'logs', 'nodered.log');
      fs.promises.appendFile(logPath, logLine).catch(() => {
        // Ignore log file errors
      });
    }
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number): void {
    this.clearHealthCheckTimer();
    this.clearReadinessPollTimer();

    if (this.runtimeState.intentionalStop) {
      // Intentional stop - transition to stopped
      this.setState('stopped');
      this.runtimeState.pid = null;
      this.runtimeState.process = null;
      this.emitNodeRedEvent({ type: 'nodered:stopped' });
    } else {
      // Crash detected
      this.runtimeState.pid = null;
      this.runtimeState.process = null;
      this.runtimeState.restartCount++;
      this.removePidFile();

      this.emitNodeRedEvent({
        type: 'nodered:error',
        error: `Node-RED process exited with code ${code}`,
      });

      if (this.runtimeState.restartCount <= this.config.maxRestartAttempts) {
        // Auto-restart with exponential backoff: 1s, 2s, 4s, ...
        const backoffMs = 1000 * Math.pow(2, this.runtimeState.restartCount - 1);
        this.setState('stopped');

        setTimeout(async () => {
          await this.start();
        }, backoffMs);
      } else {
        // All retries exhausted - transition to failed
        this.setState('failed');
        this.emitNodeRedEvent({
          type: 'nodered:failed',
          error: `Node-RED failed after ${this.config.maxRestartAttempts} restart attempts`,
        });
        if (this.onAllRetriesExhausted) {
          this.onAllRetriesExhausted().catch(() => {
            // ignore callback errors
          });
        }
      }
    }
  }

  /**
   * Stop the Node-RED process
   */
  async stop(): Promise<void> {
    const state = this.runtimeState.state;

    // Idempotency check
    if (state === 'stopped' || state === 'disabled') {
      return;
    }

    // Set intentional stop flag
    this.runtimeState.intentionalStop = true;

    // Clear timers
    this.clearHealthCheckTimer();
    this.clearReadinessPollTimer();

    // Kill process
    if (this.runtimeState.process) {
      const proc = this.runtimeState.process;

      // Send SIGTERM
      proc.kill(15);

      // Wait for graceful shutdown with timeout
      const shutdownTimeout = this.config.shutdownTimeout * 1000;
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          // Force kill if still running
          try {
            proc.kill(9); // SIGKILL
            this.runtimeState.logBuffer?.push(
              `[slashbot] Forced termination (SIGKILL) after ${this.config.shutdownTimeout}s timeout`,
            );
          } catch {
            // Process already dead
          }
          resolve();
        }, shutdownTimeout);
      });

      await Promise.race([proc.exited, timeoutPromise]);
    }

    // Transition to stopped (guard: may already be stopped from handleProcessExit)
    if (this.runtimeState.state !== 'stopped') {
      this.setState('stopped');
    }
    this.runtimeState.pid = null;
    this.runtimeState.process = null;
    this.removePidFile();
    this.emitNodeRedEvent({ type: 'nodered:stopped' });
  }

  /**
   * Restart the Node-RED process
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Get current state
   */
  getState(): NodeRedState {
    return this.runtimeState.state;
  }

  /**
   * Get current configuration (return a copy)
   */
  getConfig(): NodeRedConfig {
    return { ...this.config };
  }

  /**
   * Get current status snapshot
   */
  getStatus(logLines: number = 10): NodeRedStatus {
    const uptime =
      this.runtimeState.state === 'running' && this.runtimeState.startedAt
        ? Math.floor((Date.now() - this.runtimeState.startedAt.getTime()) / 1000)
        : null;

    return {
      state: this.runtimeState.state,
      pid: this.runtimeState.pid,
      port: this.runtimeState.state === 'running' ? this.config.port : null,
      uptime,
      restartCount: this.runtimeState.restartCount,
      recentLogs: this.runtimeState.logBuffer?.tail(logLines) || [],
    };
  }

  /**
   * Save configuration to disk with restricted permissions (mode 0600).
   * Merges partial config with existing config before saving.
   */
  async saveConfig(config: Partial<NodeRedConfig>): Promise<void> {
    // Merge with existing config
    this.config = { ...this.config, ...config };

    // Write to file
    const configPath = path.join(this.homePath, 'nodered.json');
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    await Bun.write(configPath, JSON.stringify(this.config, null, 2));
    fs.chmodSync(configPath, 0o600);
  }

  /**
   * Destroy the manager (cleanup)
   */
  async destroy(): Promise<void> {
    const state = this.runtimeState.state;

    if (state === 'running' || state === 'starting') {
      await this.stop();
    } else if (state === 'failed' && this.runtimeState.process) {
      // Clean up any lingering process in failed state
      try {
        this.runtimeState.process.kill(9);
      } catch {
        // Process already dead
      }
    }

    this.clearHealthCheckTimer();
    this.clearReadinessPollTimer();
    this.clearSetupMonitorTimer();
    this.runtimeState.logBuffer?.clear();
    this.runtimeState.process = null;
    this.runtimeState.pid = null;

    // Close log file handle
    if (this.logFileHandle) {
      await this.logFileHandle.close().catch(() => {});
      this.logFileHandle = null;
    }
  }

  /**
   * Get the crash restart count (number of consecutive restart attempts).
   */
  getCrashRestartCount(): number {
    return this.runtimeState.restartCount;
  }

  /**
   * Optional callback invoked when all retry attempts are exhausted.
   */
  onAllRetriesExhausted?: () => Promise<void>;

  /**
   * Resolve userDir path (expand tilde)
   */
  private resolveUserDir(): string {
    return this.config.userDir.replace(/^~/, os.homedir());
  }

  /**
   * Returns the path to the PID file.
   */
  private pidFilePath(): string {
    return path.join(this.resolveUserDir(), 'nodered.pid');
  }

  /**
   * Remove PID file, ignoring errors.
   */
  private removePidFile(): void {
    const pidPath = this.pidFilePath();
    try {
      if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
    } catch {
      // ignore
    }
  }
}
