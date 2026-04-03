/**
 * Contract: Node-RED Slash Commands
 *
 * Design contract for the /nodered command family.
 * All commands resolve NodeRedManager from DI and delegate.
 */

// --- Command Definitions ---

/**
 * /nodered start
 *   - Calls manager.start()
 *   - Idempotent: "Node-RED is already running (port {port})" if running
 *   - Error: "Node-RED requires Node.js..." if unavailable
 *   - Success: "Starting Node-RED on port {port}..."
 *
 * /nodered stop
 *   - Calls manager.stop()
 *   - Idempotent: "Node-RED is not running." if stopped
 *   - Success: "Node-RED stopped."
 *
 * /nodered restart
 *   - Calls manager.restart()
 *   - Success: "Restarting Node-RED..."
 *
 * /nodered status
 *   - Calls manager.getStatus(20)
 *   - Displays: state, PID, port, uptime, restart count
 *   - Optionally shows last N log lines
 *
 * /nodered config
 *   - Calls manager.getConfig()
 *   - Displays current configuration as formatted table
 *
 * /nodered config <key> <value>
 *   - Calls manager.saveConfig({ [key]: value })
 *   - Supported keys: port, healthCheckInterval, shutdownTimeout, maxRestartAttempts
 *   - Displays confirmation message
 */

export interface NodeRedCommandHandler {
  name: 'nodered';
  aliases: ['nr'];
  description: 'Manage the Node-RED instance';
  usage: '/nodered <start|stop|restart|status|config> [args]';

  execute(args: string[]): Promise<void>;
}

// --- Display Formats ---

/**
 * Status display format:
 *
 * ┌ Node-RED Status ────────────────┐
 * │ State:    Running               │
 * │ PID:      12345                 │
 * │ Port:     1880                  │
 * │ Uptime:   2h 15m               │
 * │ Restarts: 0                    │
 * ├──────────────────────────────────┤
 * │ Recent logs:                    │
 * │ [12:30:01] Node-RED started    │
 * │ [12:30:05] Flows started       │
 * └──────────────────────────────────┘
 */

/**
 * Config display format:
 *
 * ┌ Node-RED Configuration ─────────┐
 * │ enabled:            true        │
 * │ port:               1880        │
 * │ healthCheckInterval: 30s        │
 * │ shutdownTimeout:    10s         │
 * │ maxRestartAttempts: 3           │
 * │ localhostOnly:      true        │
 * │ userDir:            ~/.slashbot/nodered │
 * └──────────────────────────────────┘
 */
