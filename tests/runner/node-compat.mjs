#!/usr/bin/env node
/**
 * Node.js 20 compatibility test for dist/runner.cjs
 * Run with: node tests/runner/node-compat.mjs
 * Requires prior build: bun run runner:build
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(__dirname, '../../dist/runner.cjs');

// Verify bundle exists
if (!existsSync(bundlePath)) {
  console.error(`FAIL: Bundle not found at ${bundlePath}. Run: bun run runner:build`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { SlashbotRunner, PluginRegistry } = require(bundlePath);

// Verify exports exist
if (typeof SlashbotRunner !== 'function') {
  console.error('FAIL: SlashbotRunner is not a constructor');
  process.exit(1);
}
if (typeof PluginRegistry !== 'function') {
  console.error('FAIL: PluginRegistry is not a constructor');
  process.exit(1);
}

// Execute with stub plugin and collect events
const registry = new PluginRegistry();
registry.register('node-compat-test', {
  stepTypes: ['node-compat-test'],
  async *execute(_payload) {
    yield { type: 'output_chunk', content: 'node-compat-output' };
    yield { type: 'step_complete', result: 'node-compat-done' };
  },
});

const runner = new SlashbotRunner(registry);
const events = [];
for await (const event of runner.executeStep({
  stepType: 'node-compat-test',
  prompt: 'test',
  model: 'claude-opus-4-6',
  workspacePath: '/tmp',
  credentials: { CLAUDE_API_KEY: 'test-key' },
})) {
  events.push(event);
}

if (events.length !== 2) {
  console.error(`FAIL: Expected 2 events, got ${events.length}`);
  process.exit(1);
}
if (events[0].type !== 'output_chunk' || events[0].content !== 'node-compat-output') {
  console.error('FAIL: First event mismatch', events[0]);
  process.exit(1);
}
if (events[1].type !== 'step_complete' || events[1].result !== 'node-compat-done') {
  console.error('FAIL: Second event mismatch', events[1]);
  process.exit(1);
}

console.log('PASS: Node.js compatibility test passed');
console.log(`  Node.js version: ${process.version}`);
console.log(`  Bundle: ${bundlePath}`);
console.log(`  Events received: ${events.length}`);
