/**
 * Unit tests for ConversationStore
 */
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversationStore } from '../../src/plugins/webui/services/conversation-store.js';
import { createTempConversationsDir, cleanupTempDir } from './setup.js';

let dir: string;
let store: ConversationStore;

beforeEach(async () => {
  dir = await createTempConversationsDir();
  store = new ConversationStore(dir);
  await store.init();
});

afterEach(async () => {
  await cleanupTempDir(dir);
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('create', () => {
  it('returns metadata with a UUID id', async () => {
    const meta = await store.create();
    expect(meta.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('returns metadata with ISO timestamps', async () => {
    const meta = await store.create();
    expect(() => new Date(meta.createdAt)).not.toThrow();
    expect(() => new Date(meta.updatedAt)).not.toThrow();
  });

  it('starts with messageCount=0, title=null, preview=null', async () => {
    const meta = await store.create();
    expect(meta.messageCount).toBe(0);
    expect(meta.title).toBeNull();
    expect(meta.preview).toBeNull();
  });

  it('creates a corresponding JSONL file', async () => {
    const meta = await store.create();
    const content = await readFile(join(dir, `${meta.id}.jsonl`), 'utf8');
    expect(content).toBe('');
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe('list', () => {
  it('returns conversations sorted by updatedAt descending', async () => {
    const a = await store.create();
    // Wait a tick to get a different timestamp
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.create();

    const listed = await store.list();
    expect(listed[0].id).toBe(b.id);
    expect(listed[1].id).toBe(a.id);
  });

  it('returns empty array when no conversations exist', async () => {
    const listed = await store.list();
    expect(listed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe('get', () => {
  it('returns null for unknown id', async () => {
    const result = await store.get('00000000-0000-4000-8000-000000000000');
    expect(result).toBeNull();
  });

  it('returns metadata and messages array for existing conversation', async () => {
    const meta = await store.create();
    const result = await store.get(meta.id);
    expect(result).not.toBeNull();
    expect(result!.metadata.id).toBe(meta.id);
    expect(Array.isArray(result!.messages)).toBe(true);
    expect(result!.messages).toHaveLength(0);
  });

  it('returns messages after append', async () => {
    const meta = await store.create();
    const msg = { ts: new Date().toISOString(), msg: { role: 'user', content: 'hello' } };
    await store.append(meta.id, [msg]);
    const result = await store.get(meta.id);
    expect(result!.messages).toHaveLength(1);
    expect(result!.messages[0].msg['content']).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// append
// ---------------------------------------------------------------------------

describe('append', () => {
  it('updates messageCount in index', async () => {
    const meta = await store.create();
    const msg = { ts: new Date().toISOString(), msg: { role: 'user', content: 'hi' } };
    await store.append(meta.id, [msg]);
    const listed = await store.list();
    const updated = listed.find((m) => m.id === meta.id)!;
    expect(updated.messageCount).toBe(1);
  });

  it('updates updatedAt in index', async () => {
    const meta = await store.create();
    const before = meta.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const msg = { ts: new Date().toISOString(), msg: { role: 'user', content: 'hi' } };
    await store.append(meta.id, [msg]);
    const listed = await store.list();
    const updated = listed.find((m) => m.id === meta.id)!;
    expect(updated.updatedAt >= before).toBe(true);
  });

  it('accumulates multiple appends', async () => {
    const meta = await store.create();
    const msg1 = { ts: new Date().toISOString(), msg: { role: 'user', content: 'first' } };
    const msg2 = { ts: new Date().toISOString(), msg: { role: 'assistant', content: 'second' } };
    await store.append(meta.id, [msg1]);
    await store.append(meta.id, [msg2]);
    const result = await store.get(meta.id);
    expect(result!.messages).toHaveLength(2);
  });

  it('throws for unknown conversation id', async () => {
    const msg = { ts: new Date().toISOString(), msg: {} };
    await expect(
      store.append('00000000-0000-4000-8000-000000000000', [msg]),
    ).rejects.toThrow('not found');
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe('delete', () => {
  it('removes the conversation from list', async () => {
    const meta = await store.create();
    await store.delete(meta.id);
    const listed = await store.list();
    expect(listed.find((m) => m.id === meta.id)).toBeUndefined();
  });

  it('removes the JSONL file', async () => {
    const meta = await store.create();
    await store.delete(meta.id);
    const result = await store.get(meta.id);
    expect(result).toBeNull();
  });

  it('returns true on successful delete', async () => {
    const meta = await store.create();
    const ok = await store.delete(meta.id);
    expect(ok).toBe(true);
  });

  it('returns false for unknown id', async () => {
    const ok = await store.delete('00000000-0000-4000-8000-000000000000');
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// index rebuild
// ---------------------------------------------------------------------------

describe('index rebuild', () => {
  it('rebuilds from JSONL files when index.json is missing', async () => {
    // Create a conversation manually as JSONL
    const id = crypto.randomUUID();
    const msg = JSON.stringify({ ts: new Date().toISOString(), msg: { content: 'test' } });
    await writeFile(join(dir, `${id}.jsonl`), msg + '\n', 'utf8');

    // New store without init — then init without index
    const store2 = new ConversationStore(dir);
    await store2.init(); // index.json exists from setup; overwrite with corrupt data
    await writeFile(join(dir, 'index.json'), '{ invalid json !!!', 'utf8');

    const store3 = new ConversationStore(dir);
    await store3.init();
    const listed = await store3.list();
    // Should find the JSONL file in the rebuild
    expect(listed.some((m) => m.id === id)).toBe(true);
  });

  it('rebuilds with correct messageCount from JSONL', async () => {
    const id = crypto.randomUUID();
    const lines = [
      JSON.stringify({ ts: new Date().toISOString(), msg: { content: 'msg1' } }),
      JSON.stringify({ ts: new Date().toISOString(), msg: { content: 'msg2' } }),
    ].join('\n') + '\n';
    await writeFile(join(dir, `${id}.jsonl`), lines, 'utf8');
    await writeFile(join(dir, 'index.json'), '{ corrupt', 'utf8');

    const store2 = new ConversationStore(dir);
    await store2.init();
    const listed = await store2.list();
    const found = listed.find((m) => m.id === id);
    expect(found?.messageCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// corrupted file handling
// ---------------------------------------------------------------------------

describe('corrupted JSONL handling', () => {
  it('skips malformed lines and returns valid ones', async () => {
    const meta = await store.create();
    const goodLine = JSON.stringify({ ts: new Date().toISOString(), msg: { content: 'valid' } });
    const badLine = '{ not valid json !!!';
    await writeFile(join(dir, `${meta.id}.jsonl`), `${goodLine}\n${badLine}\n`, 'utf8');

    const result = await store.get(meta.id);
    expect(result!.messages).toHaveLength(1);
    expect(result!.messages[0].msg['content']).toBe('valid');
  });

  it('returns empty messages for entirely corrupt JSONL', async () => {
    const meta = await store.create();
    await writeFile(join(dir, `${meta.id}.jsonl`), 'totally invalid\nalso bad\n', 'utf8');

    const result = await store.get(meta.id);
    expect(result!.messages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generateTitle
// ---------------------------------------------------------------------------

describe('generateTitle', () => {
  it('calls llmAdapter.complete with a prompt containing the first message', async () => {
    const meta = await store.create();
    const msg = { ts: new Date().toISOString(), msg: { content: 'What is Bun.js?' } };
    await store.append(meta.id, [msg]);

    const mockAdapter = {
      complete: vi.fn().mockResolvedValue('Introduction to Bun.js'),
    };

    const title = await store.generateTitle(meta.id, mockAdapter);
    expect(mockAdapter.complete).toHaveBeenCalledOnce();
    const prompt = mockAdapter.complete.mock.calls[0][0] as string;
    expect(prompt).toContain('What is Bun.js?');
    expect(title).toBe('Introduction to Bun.js');
  });

  it('updates the title in the index', async () => {
    const meta = await store.create();
    const msg = { ts: new Date().toISOString(), msg: { content: 'Tell me about TypeScript.' } };
    await store.append(meta.id, [msg]);

    const mockAdapter = { complete: vi.fn().mockResolvedValue('TypeScript Overview') };
    await store.generateTitle(meta.id, mockAdapter);

    const listed = await store.list();
    const updated = listed.find((m) => m.id === meta.id)!;
    expect(updated.title).toBe('TypeScript Overview');
  });

  it('returns null for conversation with no messages', async () => {
    const meta = await store.create();
    const mockAdapter = { complete: vi.fn().mockResolvedValue('Should not be called') };
    const title = await store.generateTitle(meta.id, mockAdapter);
    expect(title).toBeNull();
    expect(mockAdapter.complete).not.toHaveBeenCalled();
  });

  it('returns null when llmAdapter.complete throws', async () => {
    const meta = await store.create();
    const msg = { ts: new Date().toISOString(), msg: { content: 'hello' } };
    await store.append(meta.id, [msg]);

    const mockAdapter = { complete: vi.fn().mockRejectedValue(new Error('LLM error')) };
    const title = await store.generateTitle(meta.id, mockAdapter);
    expect(title).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateTitle / updatePreview
// ---------------------------------------------------------------------------

describe('updateTitle', () => {
  it('updates title in index', async () => {
    const meta = await store.create();
    await store.updateTitle(meta.id, 'My Title');
    const listed = await store.list();
    expect(listed.find((m) => m.id === meta.id)!.title).toBe('My Title');
  });

  it('throws for unknown id', async () => {
    await expect(
      store.updateTitle('00000000-0000-4000-8000-000000000000', 'x'),
    ).rejects.toThrow('not found');
  });
});

describe('updatePreview', () => {
  it('updates preview in index', async () => {
    const meta = await store.create();
    await store.updatePreview(meta.id, 'Preview text...');
    const listed = await store.list();
    expect(listed.find((m) => m.id === meta.id)!.preview).toBe('Preview text...');
  });
});
