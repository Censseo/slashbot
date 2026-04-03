/**
 * Runner Module — Canonical Type Contract
 *
 * Feature: 013-slashbot-runner-module
 * This file is the authoritative source for all public types in src/runner/.
 * Implementation MUST match these signatures exactly.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * All information needed to execute a step via SlashbotRunner.executeStep().
 * Validated with Zod at the executeStep boundary.
 */
export interface StepPayload {
  /** Plugin lookup key. Exact string match. e.g. "claude-code", "http-call" */
  stepType: string;
  /** Instruction or query for the step */
  prompt: string;
  /** LLM model identifier. e.g. "claude-opus-4-6" */
  model: string;
  /** Absolute path to workspace directory */
  workspacePath: string;
  /**
   * Environment-style credentials (API keys, OAuth tokens, etc.).
   * MUST NOT appear in any log output. Forwarded to plugins per-call.
   */
  credentials: Record<string, string>;
  /** Optional step-specific context (workflow node ID, etc.) */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Output Events
// ---------------------------------------------------------------------------

/** Streaming output chunk from a plugin execution */
export interface OutputChunkEvent {
  type: 'output_chunk';
  content: string;
  timestamp?: number;
}

/** A question directed at the user; blocks until answered (Feature 04 scope) */
export interface AskUserEvent {
  type: 'ask_user';
  question: string;
  callbackId: string;
  timestamp?: number;
}

/** Final success event; the iterator closes after this */
export interface StepCompleteEvent {
  type: 'step_complete';
  result: string;
  exitCode?: number;
  timestamp?: number;
}

/** Terminal error event; the iterator closes after this */
export interface ErrorEvent {
  type: 'error';
  message: string;
  /** Machine-readable code. e.g. "NO_PLUGIN", "INVALID_PAYLOAD", "PLUGIN_ERROR" */
  code?: string;
  timestamp?: number;
}

/**
 * Discriminated union of all runner events.
 * Every step execution sequence MUST end with either step_complete or error.
 */
export type RunnerEvent =
  | OutputChunkEvent
  | AskUserEvent
  | StepCompleteEvent
  | ErrorEvent;

// ---------------------------------------------------------------------------
// Plugin Interface
// ---------------------------------------------------------------------------

/**
 * Interface for step executor implementations.
 * Each RunnerPlugin handles one or more step types.
 */
export interface RunnerPlugin {
  /** Step types this plugin handles (informational; registration key is explicit) */
  readonly stepTypes: readonly string[];
  /**
   * Execute a step and yield events.
   * MUST yield step_complete or error as the final event.
   * MUST NOT throw — errors MUST be emitted as ErrorEvent.
   */
  execute(payload: StepPayload): AsyncGenerator<RunnerEvent>;
}

// ---------------------------------------------------------------------------
// Registry Interface
// ---------------------------------------------------------------------------

/**
 * Routes step types to their registered RunnerPlugin.
 * Write-once at startup; read-only during execution.
 */
export interface IPluginRegistry {
  /** Register plugin for exact step type (last-write-wins on duplicate) */
  register(stepType: string, plugin: RunnerPlugin): void;
  /** Register fallback plugin for unknown step types */
  registerDefault(plugin: RunnerPlugin): void;
  /**
   * Look up plugin for step type.
   * Returns default plugin if no exact match exists.
   * Returns undefined if neither exact nor default is registered.
   */
  getPlugin(stepType: string): RunnerPlugin | undefined;
}

// ---------------------------------------------------------------------------
// Runner Interface
// ---------------------------------------------------------------------------

/**
 * Main entry point for the slashbot runner module.
 * Stateless: all execution context lives in the AsyncGenerator lifecycle.
 */
export interface ISlashbotRunner {
  readonly registry: IPluginRegistry;
  /**
   * Execute a step and return an AsyncGenerator of RunnerEvents.
   * Never throws — errors are emitted as ErrorEvent.
   * Validates payload with Zod; invalid payloads yield ErrorEvent immediately.
   */
  executeStep(payload: StepPayload): AsyncGenerator<RunnerEvent>;
}
