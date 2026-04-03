/**
 * @module runner
 *
 * Slashbot Runner Module — public API.
 *
 * Entry point for embedding slashbot step execution into agent-service (Node.js 20).
 * Consumers should program against `ISlashbotRunner` and `IPluginRegistry` interfaces.
 *
 * Typical usage:
 * ```typescript
 * import { SlashbotRunner, PluginRegistry } from './runner/index.js';
 *
 * const registry = new PluginRegistry();
 * registry.register('claude-code', myPlugin);
 * const runner = new SlashbotRunner(registry);
 *
 * for await (const event of runner.executeStep(payload)) {
 *   // handle RunnerEvent
 * }
 * ```
 */

/** Main entry point — orchestrates validation, routing, and event streaming. */
export { SlashbotRunner } from './runner.js';

/** Routes step types to their registered RunnerPlugin implementations. */
export { PluginRegistry } from './registry.js';

/** Zod schema for validating StepPayload at the executeStep boundary. */
export { StepPayloadSchema } from './types.js';

/** Machine-readable error codes emitted in ErrorEvent.code. */
export { RUNNER_ERRORS } from './types.js';

export type {
  /** Input contract for executeStep — validated with StepPayloadSchema. */
  StepPayload,
  /** Discriminated union of all events emitted by executeStep. */
  RunnerEvent,
  /** Streaming output chunk from a plugin execution. */
  OutputChunkEvent,
  /** User prompt event; blocks until answered (Feature 04 scope). */
  AskUserEvent,
  /** Terminal success event; iterator closes after this. */
  StepCompleteEvent,
  /** Terminal error event; iterator closes after this. */
  ErrorEvent,
  /** Interface for step executor implementations. */
  RunnerPlugin,
  /** Registry interface — use this type for dependency injection. */
  IPluginRegistry,
  /** Runner interface — use this type for dependency injection. */
  ISlashbotRunner,
} from './types.js';
