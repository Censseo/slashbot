import { StepPayloadSchema, RUNNER_ERRORS } from './types.js';
import { PluginRegistry } from './registry.js';
import type { StepPayload, RunnerEvent, ISlashbotRunner, IPluginRegistry } from './types.js';

export class SlashbotRunner implements ISlashbotRunner {
  readonly registry: IPluginRegistry;

  constructor(registry?: IPluginRegistry) {
    this.registry = registry ?? new PluginRegistry();
  }

  /**
   * Execute a step and return an async stream of RunnerEvents.
   *
   * Never throws — all errors are emitted as `error` RunnerEvents.
   *
   * **Plugin contract**: plugins MUST yield a terminal `step_complete` or `error`
   * event as their final emission. Plugins that never emit a terminal event will
   * cause the caller to await indefinitely. Callers that require a timeout should
   * implement their own deadline around this iterator.
   */
  async *executeStep(payload: StepPayload): AsyncGenerator<RunnerEvent> {
    const parsed = StepPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      yield {
        type: 'error',
        message: `Invalid payload: ${parsed.error.message}`,
        code: RUNNER_ERRORS.INVALID_PAYLOAD,
      };
      return;
    }

    const plugin = this.registry.getPlugin(parsed.data.stepType);
    if (!plugin) {
      yield {
        type: 'error',
        message: `No plugin registered for step type: ${parsed.data.stepType}`,
        code: RUNNER_ERRORS.NO_PLUGIN,
      };
      return;
    }

    try {
      yield* plugin.execute(parsed.data);
    } catch (err) {
      yield {
        type: 'error',
        message: `Plugin execution failed: ${err instanceof Error ? err.message : String(err)}`,
        code: RUNNER_ERRORS.PLUGIN_ERROR,
      };
    }
  }
}
