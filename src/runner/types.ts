import { z } from 'zod';

// ---------------------------------------------------------------------------
// StepPayload
// ---------------------------------------------------------------------------

export interface StepPayload {
  stepType: string;
  prompt: string;
  model: string;
  workspacePath: string;
  credentials: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export const StepPayloadSchema = z.object({
  stepType: z.string(),
  prompt: z.string(),
  model: z.string(),
  workspacePath: z.string(),
  credentials: z.record(z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// RunnerEvent discriminated union
// ---------------------------------------------------------------------------

export interface OutputChunkEvent {
  type: 'output_chunk';
  content: string;
  timestamp?: number;
}

export interface AskUserEvent {
  type: 'ask_user';
  question: string;
  callbackId: string;
  timestamp?: number;
}

export interface StepCompleteEvent {
  type: 'step_complete';
  result: string;
  exitCode?: number;
  timestamp?: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
  timestamp?: number;
}

export type RunnerEvent =
  | OutputChunkEvent
  | AskUserEvent
  | StepCompleteEvent
  | ErrorEvent;

// ---------------------------------------------------------------------------
// Plugin interfaces
// ---------------------------------------------------------------------------

export interface RunnerPlugin {
  readonly stepTypes: readonly string[];
  execute(payload: StepPayload): AsyncGenerator<RunnerEvent>;
}

export interface IPluginRegistry {
  register(stepType: string, plugin: RunnerPlugin): void;
  registerDefault(plugin: RunnerPlugin): void;
  getPlugin(stepType: string): RunnerPlugin | undefined;
}

export interface ISlashbotRunner {
  readonly registry: IPluginRegistry;
  executeStep(payload: StepPayload): AsyncGenerator<RunnerEvent>;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const RUNNER_ERRORS = {
  NO_PLUGIN: 'NO_PLUGIN',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  PLUGIN_ERROR: 'PLUGIN_ERROR',
  INIT_ERROR: 'INIT_ERROR',
} as const;
