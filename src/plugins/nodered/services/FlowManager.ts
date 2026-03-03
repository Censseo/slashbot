/**
 * FlowManager Service
 *
 * Manages Node-RED flows with custom metadata, CRUD operations, and event emission.
 * Provides async mutex for safe concurrent file I/O and in-memory caching.
 *
 * @see /specs/002-flow-management/data-model.md
 */

import type { EventBus } from '@slashbot/core/kernel/event-bus.js';
import type {
  FlowMetadataFile,
  FlowMetadata,
  FlowEvent,
  FlowCreateInput,
  FlowUpdateInput,
  FlowInfo,
  NodeRedNode,
} from '../flow-types';
import { validateFlow } from '../flow-validator';
import type { NodeRedState } from '../types';
import * as path from 'path';
import * as fs from 'fs';

// Constants
const CURRENT_SCHEMA_VERSION = 1;
const RETRY_DELAY_MS = 1000;
const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

/**
 * Fetch with a single retry for transient errors (network failures, 502/503/504).
 * Waits RETRY_DELAY_MS before retrying. Non-transient errors are thrown immediately.
 */
async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (TRANSIENT_STATUS_CODES.has(response.status)) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return fetch(url, options);
    }
    return response;
  } catch (error) {
    // Network error — retry once
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    return fetch(url, options);
  }
}

/**
 * Sanitize Node-RED API errors into user-facing messages.
 * Strips raw HTTP details and provides descriptive context.
 */
function sanitizeApiError(status: number, context: string): string {
  switch (status) {
    case 400: return `Invalid request while ${context}. Check flow definition.`;
    case 404: return `Flow not found while ${context}.`;
    case 409: return `Conflict while ${context}. Another operation may be in progress.`;
    case 500: return `Node-RED internal error while ${context}. Check Node-RED logs.`;
    case 502:
    case 503:
    case 504: return `Node-RED is temporarily unavailable while ${context}. Try again shortly.`;
    default: return `Unexpected error (${status}) while ${context}.`;
  }
}

/**
 * Simple async mutex for serializing file I/O operations.
 * Ensures only one operation accesses the metadata file at a time.
 */
class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async lock<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for previous operation to complete (ignoring its result/error)
    const previousQueue = this.queue.catch(() => {});

    // Create a new promise that will be added to the queue
    let queueResolve!: () => void;
    const queuePromise = new Promise<void>((resolve) => {
      queueResolve = resolve;
    });

    // Update the queue to include this operation
    this.queue = previousQueue.then(() => queuePromise);

    try {
      // Wait for our turn
      await previousQueue;
      // Execute the function
      const result = await fn();
      return result;
    } finally {
      // Always release the lock, even on error
      queueResolve();
    }
  }
}

/**
 * FlowManager - Core service for Node-RED flow management.
 *
 * Responsibilities:
 * - Load/save custom metadata from ~/.slashbot/nodered/flow-metadata.json
 * - CRUD operations on flows via Node-RED Admin API
 * - Schema version validation and migration
 * - Event emission for flow lifecycle events
 * - Thread-safe operations via AsyncMutex
 */
export class FlowManager {
  private nodeRedManager: any;
  private eventBus: EventBus;
  private homePath: string;
  private metadataCache: FlowMetadataFile | null = null;
  private mutex = new AsyncMutex();

  constructor(nodeRedManager: any, eventBus: EventBus, homePath: string) {
    this.nodeRedManager = nodeRedManager;
    this.eventBus = eventBus;
    this.homePath = homePath;
  }

  private get metadataFilePath(): string {
    return path.join(this.homePath, 'nodered', 'flow-metadata.json');
  }

  /**
   * Load metadata from disk with caching and schema validation.
   * Thread-safe via mutex serialization.
   *
   * @returns FlowMetadataFile with version 1 schema
   * @throws Error if schema version is invalid or file is corrupted
   */
  async loadMetadata(): Promise<FlowMetadataFile> {
    return this.mutex.lock(async () => {
      // Return cached value if available
      if (this.metadataCache !== null) {
        return this.metadataCache;
      }

      const file = Bun.file(this.metadataFilePath);
      const exists = await file.exists();

      if (!exists) {
        // Initialize with empty metadata
        const emptyMetadata: FlowMetadataFile = { version: 1, flows: {} };
        this.metadataCache = emptyMetadata;
        return emptyMetadata;
      }

      // Read and parse file
      const data = await file.json();

      // Validate schema version
      if (typeof data.version !== 'number') {
        throw new Error('Metadata file missing required version field');
      }

      if (data.version !== CURRENT_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported metadata schema version ${data.version}. Expected ${CURRENT_SCHEMA_VERSION}.`
        );
      }

      const metadata = data as FlowMetadataFile;
      this.metadataCache = metadata;
      return metadata;
    });
  }

  /**
   * Save metadata to disk with validation and cache update.
   * Creates directory if it doesn't exist.
   * Thread-safe via mutex serialization.
   *
   * @param metadata FlowMetadataFile to persist
   * @throws Error if version is invalid or write fails
   */
  async saveMetadata(metadata: FlowMetadataFile): Promise<void> {
    return this.mutex.lock(async () => {
      // Validate version
      if (metadata.version !== CURRENT_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported metadata schema version ${metadata.version}. Expected ${CURRENT_SCHEMA_VERSION}.`
        );
      }

      // Ensure directory exists
      const dir = path.dirname(this.metadataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to disk with pretty formatting
      await Bun.write(this.metadataFilePath, JSON.stringify(metadata, null, 2));

      // Update cache
      this.metadataCache = metadata;
    });
  }

  /**
   * Check if Node-RED is ready to accept API requests.
   *
   * @returns true if NodeRedManager state is 'running'
   */
  isReady(): boolean {
    return this.nodeRedManager.getState() === 'running';
  }

  // ============================================================================
  // Helper: extract HTTP endpoint URLs from nodes
  // ============================================================================

  private extractHttpEndpoints(nodes: NodeRedNode[]): { path: string; method: string }[] {
    return nodes
      .filter(n => n.type === 'http in' && typeof n.url === 'string')
      .map(n => ({
        path: n.url as string,
        method: (typeof n.method === 'string' ? n.method : 'get').toLowerCase(),
      }));
  }

  private getPort(): number {
    return this.nodeRedManager.getConfig().port;
  }

  private getBaseUrl(): string {
    return `http://localhost:${this.getPort()}`;
  }

  // ============================================================================
  // Shared CRUD helper
  // ============================================================================

  /**
   * Shared logic for create and update: validate, call API, save metadata, emit event.
   */
  private async deployFlow(params: {
    flowId?: string;
    label: string;
    nodes: NodeRedNode[];
    configs: NodeRedNode[];
    metadataInput?: FlowCreateInput['metadata'];
    existingMeta?: FlowMetadata;
    method: 'POST' | 'PUT';
    eventType: 'flow:created' | 'flow:updated';
    errorContext: string;
  }): Promise<FlowInfo> {
    const { flowId, label, nodes, configs, metadataInput, existingMeta, method, eventType, errorContext } = params;

    // The Node-RED POST/PUT /flow endpoint creates the tab implicitly from `label`,
    // so we strip tab nodes before the API call. However, the LLM may or may not
    // include a tab node in `nodes`. For validation we need a tab node present,
    // so we synthesize one if missing.
    const hasTab = nodes.some(n => n.type === 'tab');
    let nodesForValidation: NodeRedNode[];
    if (hasTab) {
      nodesForValidation = nodes;
    } else {
      // Derive tab ID from the z field the LLM used on the nodes, or generate one
      const zValues = nodes.map(n => n.z).filter(Boolean);
      const syntheticTabId = zValues[0] as string || 'synthetic_tab';
      nodesForValidation = [
        { id: syntheticTabId, type: 'tab', label } as NodeRedNode,
        ...nodes,
      ];
    }

    const validation = await validateFlow(nodesForValidation, this.getPort());
    if (!validation.valid) {
      throw new Error(`Flow validation failed: ${validation.errors.join('; ')}`);
    }

    const apiNodes = nodes.filter(n => n.type !== 'tab');
    const url = flowId ? `${this.getBaseUrl()}/flow/${flowId}` : `${this.getBaseUrl()}/flow`;
    const body: Record<string, unknown> = { label, nodes: apiNodes, configs };
    if (flowId) body.id = flowId;

    const response = await fetchWithRetry(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Node-RED-Deployment-Type': 'flows',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Include Node-RED's actual error message so the LLM can diagnose and retry
      let detail = '';
      try {
        const errBody = await response.json() as { message?: string; code?: string };
        detail = errBody.message || errBody.code || '';
      } catch { /* ignore parse errors */ }
      const base = sanitizeApiError(response.status, errorContext);
      throw new Error(detail ? `${base} Detail: ${detail}` : base);
    }

    const resultId = flowId ?? (await response.json() as { id: string }).id;

    // Build metadata
    const now = new Date().toISOString();
    const meta: FlowMetadata = {
      flowId: resultId,
      creator: metadataInput?.creator ?? existingMeta?.creator ?? 'unknown',
      createdAt: existingMeta?.createdAt ?? now,
      updatedAt: now,
      description: metadataInput?.description ?? existingMeta?.description ?? '',
      tags: metadataInput?.tags ?? existingMeta?.tags ?? [],
      mcp: metadataInput?.mcp ?? existingMeta?.mcp ?? false,
    };

    // Save metadata
    const metadataFile = await this.loadMetadata();
    metadataFile.flows[resultId] = meta;
    await this.saveMetadata(metadataFile);

    // Emit event
    this.eventBus.publish(eventType, { flowId: resultId, label, metadata: meta as any });

    // Build result
    const httpEndpoints = this.extractHttpEndpoints(nodes);
    return {
      id: resultId,
      label,
      nodeCount: nodes.filter(n => n.type !== 'tab').length,
      httpEndpoints,
      metadata: meta,
    };
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async createFlow(input: FlowCreateInput): Promise<FlowInfo> {
    if (!this.isReady()) {
      throw new Error('Node-RED is not available');
    }

    return this.deployFlow({
      label: input.label,
      nodes: input.nodes,
      configs: input.configs || [],
      metadataInput: input.metadata,
      method: 'POST',
      eventType: 'flow:created',
      errorContext: 'creating flow',
    });
  }

  async getFlow(flowId: string): Promise<FlowInfo | null> {
    if (!this.isReady()) {
      throw new Error('Node-RED is not available');
    }

    const response = await fetchWithRetry(`${this.getBaseUrl()}/flow/${flowId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(sanitizeApiError(response.status, 'reading flow'));
    }

    const detail = await response.json() as {
      id: string;
      label: string;
      nodes: NodeRedNode[];
      configs: NodeRedNode[];
    };

    // Load metadata, enriching with defaults if missing
    const metadataFile = await this.loadMetadata();
    const meta = metadataFile.flows[flowId] ?? {
      flowId,
      creator: 'unknown',
      createdAt: '',
      updatedAt: '',
      description: '',
      tags: [],
      mcp: false,
    };

    const httpEndpoints = this.extractHttpEndpoints(detail.nodes);

    return {
      id: detail.id,
      label: detail.label,
      nodeCount: detail.nodes.length,
      httpEndpoints,
      metadata: meta,
    };
  }

  async listFlows(): Promise<FlowInfo[]> {
    if (!this.isReady()) {
      throw new Error('Node-RED is not available');
    }

    const response = await fetchWithRetry(`${this.getBaseUrl()}/flows`);

    if (!response.ok) {
      throw new Error(sanitizeApiError(response.status, 'listing flows'));
    }

    const allNodes = await response.json() as NodeRedNode[];

    // Filter tab nodes (these represent flows)
    const tabs = allNodes.filter(n => n.type === 'tab');

    // Load metadata for enrichment
    const metadataFile = await this.loadMetadata();

    // Reconcile: remove orphaned metadata entries not present in Node-RED
    const activeFlowIds = new Set(tabs.map(t => t.id));
    let hasOrphans = false;
    for (const metaId of Object.keys(metadataFile.flows)) {
      if (!activeFlowIds.has(metaId)) {
        delete metadataFile.flows[metaId];
        hasOrphans = true;
      }
    }
    if (hasOrphans) {
      await this.saveMetadata(metadataFile);
    }

    return tabs.map(tab => {
      // Collect nodes belonging to this flow
      const flowNodes = allNodes.filter(n => n.z === tab.id);
      const httpEndpoints = this.extractHttpEndpoints(flowNodes);

      const meta = metadataFile.flows[tab.id] ?? {
        flowId: tab.id,
        creator: 'unknown',
        createdAt: '',
        updatedAt: '',
        description: '',
        tags: [],
        mcp: false,
      };

      return {
        id: tab.id,
        label: (tab as any).label ?? '',
        nodeCount: flowNodes.length,
        httpEndpoints,
        metadata: meta,
      };
    });
  }

  async updateFlow(flowId: string, input: FlowUpdateInput): Promise<FlowInfo> {
    if (!this.isReady()) {
      throw new Error('Node-RED is not available');
    }

    // Fetch current flow state from Node-RED
    const getResponse = await fetchWithRetry(`${this.getBaseUrl()}/flow/${flowId}`);
    if (!getResponse.ok) {
      if (getResponse.status === 404) {
        throw new Error(`Flow not found: ${flowId}`);
      }
      throw new Error(sanitizeApiError(getResponse.status, 'fetching flow for update'));
    }

    const current = await getResponse.json() as {
      id: string;
      label: string;
      nodes: NodeRedNode[];
      configs: NodeRedNode[];
    };

    // Load existing metadata for merge
    const metadataFile = await this.loadMetadata();
    const existingMeta = metadataFile.flows[flowId];

    return this.deployFlow({
      flowId,
      label: input.label ?? current.label,
      nodes: input.nodes ?? current.nodes,
      configs: input.configs ?? current.configs,
      metadataInput: input.metadata,
      existingMeta,
      method: 'PUT',
      eventType: 'flow:updated',
      errorContext: 'updating flow',
    });
  }

  async deleteFlow(flowId: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Node-RED is not available');
    }

    // Verify flow exists
    const checkResponse = await fetchWithRetry(`${this.getBaseUrl()}/flow/${flowId}`);
    if (!checkResponse.ok) {
      if (checkResponse.status === 404) {
        throw new Error(`Flow not found: ${flowId}`);
      }
      throw new Error(sanitizeApiError(checkResponse.status, 'checking flow existence'));
    }

    // DELETE /flow/:id
    const deleteResponse = await fetchWithRetry(`${this.getBaseUrl()}/flow/${flowId}`, {
      method: 'DELETE',
    });

    if (!deleteResponse.ok) {
      throw new Error(sanitizeApiError(deleteResponse.status, 'deleting flow'));
    }

    // Remove metadata entry
    const metadataFile = await this.loadMetadata();
    const deletedMeta = metadataFile.flows[flowId] ?? {
      flowId,
      creator: 'unknown',
      createdAt: '',
      updatedAt: '',
      description: '',
      tags: [],
      mcp: false,
    };
    delete metadataFile.flows[flowId];
    await this.saveMetadata(metadataFile);

    // Emit event
    this.eventBus.publish('flow:deleted', { flowId, metadata: deletedMeta as any });
  }
}
