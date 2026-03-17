/**
 * @module plugins/webui/types
 *
 * Type definitions and Zod schemas for the Web UI gateway API plugin.
 * Covers chat request validation, SSE event shapes, plugin status,
 * and system info responses.
 */
import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Chat Request
// ---------------------------------------------------------------------------

export const ChatRequestSchema = z.object({
  message: z.string().min(1, 'message must be a non-empty string'),
  sessionId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ---------------------------------------------------------------------------
// Stream Events (SSE)
// ---------------------------------------------------------------------------

export interface TextDeltaEvent {
  type: 'text-delta';
  payload: { text: string };
}

export interface ToolCallStartEvent {
  type: 'tool-call-start';
  payload: { toolId: string; toolName: string; args: Record<string, unknown> };
}

export interface ToolCallResultEvent {
  type: 'tool-call-result';
  payload: { toolId: string; toolName: string; result: string; success: boolean };
}

export interface ErrorEvent {
  type: 'error';
  payload: { message: string };
}

export interface DoneEvent {
  type: 'done';
  payload: { sessionId: string };
}

export interface ConversationUpdateEvent {
  type: 'conversation-update';
  payload: { id: string; title?: string; preview?: string; updatedAt: string };
}

export type StreamEvent =
  | TextDeltaEvent
  | ToolCallStartEvent
  | ToolCallResultEvent
  | ErrorEvent
  | DoneEvent
  | ConversationUpdateEvent;

// ---------------------------------------------------------------------------
// Plugin Status (maps from PluginDiagnostic)
// ---------------------------------------------------------------------------

export interface PluginStatusEntry {
  pluginId: string;
  status: 'loaded' | 'disabled' | 'failed' | 'skipped';
  reason?: string;
}

// ---------------------------------------------------------------------------
// Conversation History
// ---------------------------------------------------------------------------

export const ConversationMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(100).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  preview: z.string().max(100).nullable(),
  messageCount: z.number().int().min(0),
});

export type ConversationMetadata = z.infer<typeof ConversationMetadataSchema>;

export const ConversationMessageSchema = z.object({
  ts: z.string().datetime(),
  msg: z.record(z.string(), z.unknown()),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationIndexSchema = z.object({
  conversations: z.array(ConversationMetadataSchema),
});

export type ConversationIndex = z.infer<typeof ConversationIndexSchema>;

// ---------------------------------------------------------------------------
// System Info (RPC response)
// ---------------------------------------------------------------------------

export interface SystemInfo {
  version: string;
  uptime: number;
  pluginsLoaded: number;
  pluginsFailed: number;
  connectorsActive: number;
  commandCount: number;
  toolCount: number;
  heapUsed: number;
  heapTotal: number;
}
