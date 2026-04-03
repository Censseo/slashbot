import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE = join(import.meta.dirname, '../../dist/runner.cjs');
const COMPAT_SCRIPT = join(import.meta.dirname, 'node-compat.mjs');

describe('runner/node-compat', () => {
  it('dist/runner.cjs exists (requires prior: bun run runner:build)', () => {
    expect(existsSync(BUNDLE), `Bundle not found at ${BUNDLE}. Run: bun run runner:build`).toBe(true);
  });

  it('node-compat.mjs passes in current Node.js runtime', () => {
    const result = execSync(`node ${COMPAT_SCRIPT}`, { encoding: 'utf8' });
    expect(result).toContain('PASS');
  });
});
