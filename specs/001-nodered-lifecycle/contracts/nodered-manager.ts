/**
 * Contract: NodeRedManager Service Interface
 *
 * This is the design contract — NOT implementation code.
 * It defines the public API of the NodeRedManager service
 * that the NodeRedPlugin and commands will use.
 */

// --- Types ---

export type NodeRedState =
  | 'disabled'    // Config has enabled=false
  | 'unavailable' // Node.js runtime not found
  | 'stopped'     // Ready to start, not running
  | 'starting'    // Spawn initiated, waiting for readiness
  | 'running'     // Health check passing, serving requests
  | 'failed';     // Crashed and exhausted retries

export interface NodeRedConfig {
  enabled: boolean;
  port: number;
  userDir: string;
  healthCheckInterval: number;   // seconds
  shutdownTimeout: number;       // seconds
  maxRestartAttempts: number;
  localhostOnly: boolean;
}

export interface NodeRedStatus {
  state: NodeRedState;
  pid: number | null;
  port: number;
  uptime: string | null;         // Formatted: "2h 15m", "45s", null if not running
  restartCount: number;
  lastLogLines: string[];        // Last N lines from ring buffer
}

export interface NodeRedManagerEvents {
  'nodered:ready': { port: number };
  'nodered:stopped': {};
  'nodered:error': { error: string };
  'nodered:failed': { error: string };
}

// --- Service Contract ---

export interface INodeRedManager {
  /**
   * Initialize the manager: load config, check prerequisites,
   * determine initial state. Does NOT start Node-RED.
   */
  init(): Promise<void>;

  /**
   * Start Node-RED. Non-blocking: spawns process and returns immediately.
   * Readiness is detected asynchronously via health probes.
   *
   * Idempotent: if already running, returns info message without error.
   *
   * @returns User-facing message about the operation result
   */
  start(): Promise<string>;

  /**
   * Stop Node-RED gracefully. Sends SIGTERM, waits up to shutdownTimeout,
   * then sends SIGKILL if needed.
   *
   * Idempotent: if already stopped, returns info message without error.
   * Sets intentionalStop=true to suppress auto-restart.
   *
   * @returns User-facing message about the operation result
   */
  stop(): Promise<string>;

  /**
   * Restart Node-RED: stop then start.
   * @returns User-facing message about the operation result
   */
  restart(): Promise<string>;

  /**
   * Get current status for display.
   * @param logLines Number of log lines to include (default: 10)
   */
  getStatus(logLines?: number): NodeRedStatus;

  /**
   * Get current lifecycle state.
   */
  getState(): NodeRedState;

  /**
   * Get current configuration.
   */
  getConfig(): NodeRedConfig;

  /**
   * Update configuration. Merges with existing config and saves to disk.
   * Some changes (like port) require a restart to take effect.
   *
   * @returns User-facing message about what changed
   */
  saveConfig(config: Partial<NodeRedConfig>): Promise<string>;

  /**
   * Clean shutdown: stop Node-RED and clean up timers.
   * Called by plugin.destroy() during slashbot shutdown.
   */
  destroy(): Promise<void>;
}
