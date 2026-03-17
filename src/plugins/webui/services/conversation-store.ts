/**
 * @module plugins/webui/services/conversation-store
 *
 * Persistent conversation storage using JSONL files per conversation
 * and a JSON index file for metadata.
 */
import { mkdir, readFile, writeFile, appendFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ConversationMetadataSchema,
  ConversationIndexSchema,
  type ConversationMetadata,
  type ConversationMessage,
} from '../types.js';

interface LlmAdapter {
  complete: (prompt: string) => Promise<string>;
}

export class ConversationStore {
  private indexPath: string;
  private index: ConversationMetadata[] = [];

  constructor(private baseDir: string) {
    this.indexPath = join(baseDir, 'index.json');
  }

  async init(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await this._loadOrRebuildIndex();
  }

  async create(): Promise<ConversationMetadata> {
    const now = new Date().toISOString();
    const metadata: ConversationMetadata = {
      id: crypto.randomUUID(),
      title: null,
      createdAt: now,
      updatedAt: now,
      preview: null,
      messageCount: 0,
    };
    this.index.push(metadata);
    await this._saveIndex();
    // Create empty JSONL file
    await writeFile(this._jsonlPath(metadata.id), '', 'utf8');
    return metadata;
  }

  async list(): Promise<ConversationMetadata[]> {
    return [...this.index].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async get(
    id: string,
  ): Promise<{ metadata: ConversationMetadata; messages: ConversationMessage[] } | null> {
    const metadata = this.index.find((m) => m.id === id);
    if (!metadata) return null;

    const messages = await this._readMessages(id);
    return { metadata, messages };
  }

  async append(id: string, messages: ConversationMessage[]): Promise<void> {
    const metaIdx = this.index.findIndex((m) => m.id === id);
    if (metaIdx === -1) throw new Error(`Conversation not found: ${id}`);

    const lines = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
    await appendFile(this._jsonlPath(id), lines, 'utf8');

    this.index[metaIdx] = {
      ...this.index[metaIdx],
      updatedAt: new Date().toISOString(),
      messageCount: this.index[metaIdx].messageCount + messages.length,
    };
    await this._saveIndex();
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.index.findIndex((m) => m.id === id);
    if (idx === -1) return false;

    this.index.splice(idx, 1);
    await this._saveIndex();

    try {
      await unlink(this._jsonlPath(id));
    } catch {
      // File may already be missing — that's fine
    }
    return true;
  }

  async generateTitle(id: string, llmAdapter: LlmAdapter): Promise<string | null> {
    const result = await this.get(id);
    if (!result || result.messages.length === 0) return null;

    const firstMessage = result.messages[0];
    const msgText =
      typeof firstMessage.msg['content'] === 'string'
        ? firstMessage.msg['content']
        : JSON.stringify(firstMessage.msg);

    const prompt = `Generate a short title (max 60 chars) for a conversation that starts with: "${msgText.slice(0, 200)}". Reply with ONLY the title text, no quotes or punctuation at the end.`;

    try {
      const title = (await llmAdapter.complete(prompt)).trim().slice(0, 100);
      if (title) {
        await this.updateTitle(id, title);
      }
      return title || null;
    } catch {
      return null;
    }
  }

  async updateTitle(id: string, title: string): Promise<void> {
    const idx = this.index.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Conversation not found: ${id}`);
    this.index[idx] = { ...this.index[idx], title, updatedAt: new Date().toISOString() };
    await this._saveIndex();
  }

  async updatePreview(id: string, preview: string): Promise<void> {
    const idx = this.index.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Conversation not found: ${id}`);
    this.index[idx] = { ...this.index[idx], preview, updatedAt: new Date().toISOString() };
    await this._saveIndex();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _jsonlPath(id: string): string {
    return join(this.baseDir, `${id}.jsonl`);
  }

  private async _saveIndex(): Promise<void> {
    const data = JSON.stringify({ conversations: this.index }, null, 2);
    await writeFile(this.indexPath, data, 'utf8');
  }

  private async _loadOrRebuildIndex(): Promise<void> {
    try {
      const raw = await readFile(this.indexPath, 'utf8');
      const parsed = ConversationIndexSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        this.index = parsed.data.conversations;
        return;
      }
    } catch {
      // Missing or corrupt — fall through to rebuild
    }
    await this._rebuildIndex();
  }

  private async _rebuildIndex(): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.baseDir);
    } catch {
      this.index = [];
      await this._saveIndex();
      return;
    }

    const jsonlFiles = entries.filter((f) => f.endsWith('.jsonl'));
    const rebuilt: ConversationMetadata[] = [];

    for (const file of jsonlFiles) {
      const id = file.slice(0, -6); // strip .jsonl
      const messages = await this._readMessages(id);
      const now = new Date().toISOString();
      const lastTs = messages.length > 0 ? messages[messages.length - 1].ts : now;
      rebuilt.push({
        id,
        title: null,
        createdAt: now,
        updatedAt: lastTs,
        preview: null,
        messageCount: messages.length,
      });
    }

    this.index = rebuilt;
    await this._saveIndex();
  }

  private async _readMessages(id: string): Promise<ConversationMessage[]> {
    let raw: string;
    try {
      raw = await readFile(this._jsonlPath(id), 'utf8');
    } catch {
      return [];
    }

    const filePath = this._jsonlPath(id);
    const messages: ConversationMessage[] = [];
    const lines = raw.split('\n');
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const trimmed = lines[lineNum].trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        // Validate loosely — accept any object with ts and msg
        if (parsed && typeof parsed.ts === 'string' && typeof parsed.msg === 'object') {
          messages.push(parsed as ConversationMessage);
        } else {
          console.warn(`[conversation-store] Skipping invalid record at ${filePath}:${lineNum + 1} — missing ts or msg fields`);
        }
      } catch {
        console.warn(`[conversation-store] Skipping malformed JSON at ${filePath}:${lineNum + 1}`);
      }
    }
    return messages;
  }
}
