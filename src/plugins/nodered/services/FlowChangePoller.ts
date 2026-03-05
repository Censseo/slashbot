/**
 * FlowChangePoller Service
 *
 * Polls Node-RED flows for external changes (made via the editor) by comparing
 * revision hashes. Emits `flow:external-change` events when differences are detected.
 *
 * @see /specs/006-nodered-ui-access/
 */

import type { EventBus } from '@slashbot/core/kernel/event-bus.js';
import type { FlowInfo } from '../flow-types.js';
import type { FlowChange, FlowChangeEvent } from '../types.js';

/** Minimal interface for FlowManager dependency (testability). */
export interface IFlowPoller {
  listFlows(): Promise<FlowInfo[]>;
  getFlowsRevisionHash(): Promise<string>;
  getLastKnownHash(): string | null;
  updateLastKnownHash(hash: string): void;
}

const POLL_INTERVAL_MS = 15_000;

export class FlowChangePoller {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastHash: string | null = null;
  private lastFlowSnapshot: Map<string, FlowInfo> = new Map();

  constructor(
    private readonly flowManager: IFlowPoller,
    private readonly events: Pick<EventBus, 'publish'>,
  ) {}

  /** Start polling. Guards against double-start. */
  start(): void {
    if (this.pollTimer !== null) return;
    this.lastHash = this.flowManager.getLastKnownHash();
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  /** Stop polling. */
  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Get the last known hash. */
  getLastHash(): string | null {
    return this.lastHash;
  }

  /** Update hash after bot CRUD to prevent false positives. */
  updateHash(hash: string): void {
    this.lastHash = hash;
  }

  /** Single poll cycle. */
  private async poll(): Promise<void> {
    let currentHash: string;
    try {
      currentHash = await this.flowManager.getFlowsRevisionHash();
    } catch {
      // API failure — skip this cycle, retry next interval
      return;
    }

    // First poll: set baseline, no event
    if (this.lastHash === null) {
      this.lastHash = currentHash;
      try {
        const flows = await this.flowManager.listFlows();
        this.lastFlowSnapshot = new Map(flows.map(f => [f.id, f]));
      } catch {
        // Best-effort snapshot seeding
      }
      return;
    }

    // No change
    if (currentHash === this.lastHash) return;

    // Hash changed — compute diff
    let currentFlows: FlowInfo[];
    try {
      currentFlows = await this.flowManager.listFlows();
    } catch {
      return;
    }

    const currentMap = new Map(currentFlows.map(f => [f.id, f]));
    const changes: FlowChange[] = [];

    // Detect created and modified
    for (const [id, flow] of currentMap) {
      const prev = this.lastFlowSnapshot.get(id);
      if (!prev) {
        changes.push({ flowId: id, changeType: 'created', label: flow.label });
      } else if (prev.nodeCount !== flow.nodeCount || prev.label !== flow.label) {
        changes.push({ flowId: id, changeType: 'modified', label: flow.label });
      }
    }

    // Detect deleted
    for (const [id, flow] of this.lastFlowSnapshot) {
      if (!currentMap.has(id)) {
        changes.push({ flowId: id, changeType: 'deleted', label: flow.label });
      }
    }

    const previousHash = this.lastHash;
    this.lastHash = currentHash;
    this.lastFlowSnapshot = currentMap;

    if (changes.length > 0) {
      const event: FlowChangeEvent = {
        type: 'flow:external-change',
        changes,
        detectedAt: Date.now(),
        previousHash,
        currentHash,
      };
      this.events.publish('flow:external-change', event);
    }
  }
}
