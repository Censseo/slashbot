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

// ---------------------------------------------------------------------------
// Memory Dashboard — AssociationGraph interface (optional dependency)
// ---------------------------------------------------------------------------

export interface AssociationGraphLike {
  getAllNodeIds(): string[];
  getNode(id: string): GraphNode | undefined;
  neighbors(nodeId: string, depth?: number, typeFilter?: string): NeighborResult[];
  nodeCount(): number;
  /** Internal edge storage — may be a Map<string, GraphEdge>. */
  edges?: Map<string, GraphEdge> | unknown;
}

// ---------------------------------------------------------------------------
// Memory Dashboard — Request Schemas
// ---------------------------------------------------------------------------

export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().optional().default(20),
});

export const FileContentSchema = z.object({
  content: z.string(),
});

export const QuickNoteSchema = z.object({
  text: z.string().min(1),
});

export const TimelineQuerySchema = z.object({
  days: z.coerce.number().int().positive().optional().default(7),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const NeighborQuerySchema = z.object({
  depth: z.coerce.number().int().positive().optional().default(1),
});

// ---------------------------------------------------------------------------
// Memory Dashboard — Response Types
// ---------------------------------------------------------------------------

export interface DayCount {
  date: string;
  count: number;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  nodeTypeDistribution: Record<string, number>;
}

export interface CombinedStats {
  memory: { files: number; chunks: number; indexedAt: string };
  graph: GraphStats | null;
  recentActivity: DayCount[];
}

export interface MemoryFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: MemoryFileNode[];
}

export interface MemoryFileContent {
  path: string;
  content: string;
  lastModified: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  meta?: Record<string, string>;
  created: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  rel: string;
  weight: number;
  created: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface MemorySearchHit {
  path: string;
  line: number;
  text: string;
  score: number;
}

export interface GraphSearchHit {
  node: GraphNode;
  matchedOn: 'label';
  edges: GraphEdge[];
}

export interface UnifiedSearchResult {
  memory: MemorySearchHit[];
  graph: GraphSearchHit[];
}

export interface TimelineEntry {
  timestamp: string;
  tags: string[];
  preview: string;
  content: string;
}

export interface TimelineDay {
  date: string;
  entries: TimelineEntry[];
}

export interface NeighborResult {
  id: string;
  label: string;
  type?: string;
  rel: string;
  weight: number;
  direction: 'outgoing' | 'incoming';
}
