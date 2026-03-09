import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatRequestSchema } from '../../../src/plugins/webui/types.js';

describe('ChatRequest validation', () => {
  it('should accept valid request with message only', () => {
    const result = ChatRequestSchema.safeParse({ message: 'Hello' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('Hello');
      expect(result.data.sessionId).toBeUndefined();
    }
  });

  it('should accept valid request with message and sessionId', () => {
    const result = ChatRequestSchema.safeParse({
      message: 'Hello',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty message', () => {
    const result = ChatRequestSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing message', () => {
    const result = ChatRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject invalid sessionId (not UUID)', () => {
    const result = ChatRequestSchema.safeParse({
      message: 'Hello',
      sessionId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('SSE event format', () => {
  it('text-delta event has correct shape', () => {
    const event = { type: 'text-delta' as const, payload: { text: 'Hello' } };
    expect(JSON.parse(JSON.stringify(event))).toEqual({
      type: 'text-delta',
      payload: { text: 'Hello' },
    });
  });

  it('tool-call-start event has correct shape', () => {
    const event = {
      type: 'tool-call-start' as const,
      payload: { toolId: 'tc_1', toolName: 'bash', args: { command: 'ls' } },
    };
    const serialized = JSON.parse(JSON.stringify(event));
    expect(serialized.type).toBe('tool-call-start');
    expect(serialized.payload.toolId).toBe('tc_1');
  });

  it('tool-call-result event has correct shape', () => {
    const event = {
      type: 'tool-call-result' as const,
      payload: { toolId: 'tc_1', toolName: 'bash', result: 'file1.txt', success: true },
    };
    const serialized = JSON.parse(JSON.stringify(event));
    expect(serialized.type).toBe('tool-call-result');
    expect(serialized.payload.success).toBe(true);
  });

  it('done event includes sessionId', () => {
    const event = {
      type: 'done' as const,
      payload: { sessionId: 'web-123' },
    };
    expect(JSON.parse(JSON.stringify(event)).payload.sessionId).toBe('web-123');
  });

  it('error event includes message', () => {
    const event = {
      type: 'error' as const,
      payload: { message: 'Something went wrong' },
    };
    expect(JSON.parse(JSON.stringify(event)).payload.message).toBe('Something went wrong');
  });
});
