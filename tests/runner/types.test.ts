import { describe, it, expect } from 'vitest';
import { StepPayloadSchema, RUNNER_ERRORS } from '../../src/runner/types.js';
import type { RunnerEvent, OutputChunkEvent, AskUserEvent, StepCompleteEvent, ErrorEvent } from '../../src/runner/types.js';

describe('StepPayloadSchema', () => {
  const validPayload = {
    stepType: 'claude-code',
    prompt: 'Write a hello world function',
    model: 'claude-opus-4-6',
    workspacePath: '/home/user/project',
    credentials: { CLAUDE_API_KEY: 'test-key' },
  };

  it('accepts valid StepPayload with all required fields', () => {
    const result = StepPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts optional metadata field', () => {
    const result = StepPayloadSchema.safeParse({
      ...validPayload,
      metadata: { nodeId: 'abc123', workflowId: 'wf-1' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({ nodeId: 'abc123', workflowId: 'wf-1' });
    }
  });

  it('rejects missing stepType', () => {
    const { stepType: _, ...rest } = validPayload;
    const result = StepPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing prompt', () => {
    const { prompt: _, ...rest } = validPayload;
    const result = StepPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing model', () => {
    const { model: _, ...rest } = validPayload;
    const result = StepPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing workspacePath', () => {
    const { workspacePath: _, ...rest } = validPayload;
    const result = StepPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing credentials', () => {
    const { credentials: _, ...rest } = validPayload;
    const result = StepPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-string stepType', () => {
    const result = StepPayloadSchema.safeParse({ ...validPayload, stepType: 42 });
    expect(result.success).toBe(false);
  });

  it('rejects non-object credentials', () => {
    const result = StepPayloadSchema.safeParse({ ...validPayload, credentials: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('RunnerEvent type narrowing', () => {
  it('narrows output_chunk event', () => {
    const event: RunnerEvent = { type: 'output_chunk', content: 'hello' };
    if (event.type === 'output_chunk') {
      const typed: OutputChunkEvent = event;
      expect(typed.content).toBe('hello');
    }
  });

  it('narrows ask_user event', () => {
    const event: RunnerEvent = { type: 'ask_user', question: 'Are you sure?', callbackId: 'cb-1' };
    if (event.type === 'ask_user') {
      const typed: AskUserEvent = event;
      expect(typed.question).toBe('Are you sure?');
      expect(typed.callbackId).toBe('cb-1');
    }
  });

  it('narrows step_complete event', () => {
    const event: RunnerEvent = { type: 'step_complete', result: 'done' };
    if (event.type === 'step_complete') {
      const typed: StepCompleteEvent = event;
      expect(typed.result).toBe('done');
    }
  });

  it('narrows error event', () => {
    const event: RunnerEvent = { type: 'error', message: 'Something failed', code: 'PLUGIN_ERROR' };
    if (event.type === 'error') {
      const typed: ErrorEvent = event;
      expect(typed.message).toBe('Something failed');
      expect(typed.code).toBe('PLUGIN_ERROR');
    }
  });
});

describe('RUNNER_ERRORS', () => {
  it('defines NO_PLUGIN code', () => {
    expect(RUNNER_ERRORS.NO_PLUGIN).toBe('NO_PLUGIN');
  });

  it('defines INVALID_PAYLOAD code', () => {
    expect(RUNNER_ERRORS.INVALID_PAYLOAD).toBe('INVALID_PAYLOAD');
  });

  it('defines PLUGIN_ERROR code', () => {
    expect(RUNNER_ERRORS.PLUGIN_ERROR).toBe('PLUGIN_ERROR');
  });

  it('defines INIT_ERROR code', () => {
    expect(RUNNER_ERRORS.INIT_ERROR).toBe('INIT_ERROR');
  });
});
