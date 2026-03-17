/**
 * Test setup helpers for webui conversation history tests.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Create a temporary directory for test data, cleaned up via afterEach/afterAll. */
export async function createTempConversationsDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'slashbot-webui-test-'));
}

/** Remove a temporary directory recursively. */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
