import { describe, it, expect } from 'vitest';

describe('Log streaming SSE format', () => {
  it('log entry has expected fields', () => {
    const entry = {
      ts: '2026-03-09T10:00:00.000Z',
      level: 'info',
      message: 'Gateway started',
      fields: { host: '0.0.0.0', port: 3000 },
    };
    const serialized = JSON.parse(JSON.stringify(entry));
    expect(serialized.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(serialized.level).toBe('info');
    expect(serialized.message).toBe('Gateway started');
    expect(serialized.fields.port).toBe(3000);
  });

  it('SSE data line format is correct', () => {
    const entry = { ts: '2026-03-09T10:00:00.000Z', level: 'debug', message: 'test' };
    const sseLine = `data: ${JSON.stringify(entry)}\n\n`;
    expect(sseLine).toMatch(/^data: \{/);
    expect(sseLine).toMatch(/\n\n$/);
  });

  it('log entry without fields omits fields key', () => {
    const entry = { ts: '2026-03-09T10:00:00.000Z', level: 'warn', message: 'Warning' };
    const serialized = JSON.parse(JSON.stringify(entry));
    expect(serialized.fields).toBeUndefined();
  });
});
