/**
 * delta-queue.ts — Property-Level Delta Queue & LWW Conflict Resolver for Glide.
 *
 * Implements Figma/v0-style Property-Level Last-Writer-Wins (LWW) conflict resolution:
 *   - Conflicts resolve per property key (nodeId, propKey) based on arrival timestamps.
 *   - Concurrent edits to distinct properties of the same element (e.g. width vs backgroundColor)
 *     both apply without clobbering.
 *   - Maintains in-flight pending operations per (nodeId, propKey) and defers or serializes
 *     conflicting concurrent writes until local ops are ACKed.
 */

export interface PendingOp {
  opId: string;
  nodeId: string;
  prop: string;
  value: unknown;
  timestamp: number;
  clientId?: string;
}

export interface AppliedOp {
  nodeId: string;
  prop: string;
  value: unknown;
  timestamp: number;
}

export interface DeltaQueueStats {
  pendingCount: number;
  appliedCount: number;
  deferredCount: number;
}

export class PropertyDeltaQueue {
  private pendingOps = new Map<string, PendingOp>();
  private appliedOps = new Map<string, AppliedOp>();
  private deferredQueue: Array<{
    key: string;
    op: PendingOp;
    action: () => Promise<void> | void;
  }> = [];

  private makeKey(nodeId: string, prop: string): string {
    return `${nodeId}::${prop}`;
  }

  /**
   * Enqueue an in-flight operation for a specific property on a node.
   */
  public enqueuePending(
    nodeId: string,
    prop: string,
    value: unknown,
    clientId?: string,
    timestamp = Date.now()
  ): string {
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const key = this.makeKey(nodeId, prop);
    this.pendingOps.set(key, { opId, nodeId, prop, value, timestamp, clientId });
    return opId;
  }

  /**
   * Mark an in-flight operation for (nodeId, prop) as ACKed.
   * Flushes any deferred operations queued for this property.
   */
  public ackPending(nodeId: string, prop: string): boolean {
    const key = this.makeKey(nodeId, prop);
    const removed = this.pendingOps.delete(key);
    this.flushDeferred(key);
    return removed;
  }

  /**
   * Mark an operation as ACKed by opId.
   */
  public ackOpId(opId: string): boolean {
    for (const [key, op] of this.pendingOps.entries()) {
      if (op.opId === opId) {
        this.pendingOps.delete(key);
        this.flushDeferred(key);
        return true;
      }
    }
    return false;
  }

  /**
   * Check whether an operation is currently in-flight for (nodeId, prop).
   */
  public hasPending(nodeId: string, prop: string): boolean {
    return this.pendingOps.has(this.makeKey(nodeId, prop));
  }

  /**
   * Get the active pending operation for (nodeId, prop).
   */
  public getPending(nodeId: string, prop: string): PendingOp | undefined {
    return this.pendingOps.get(this.makeKey(nodeId, prop));
  }

  /**
   * Last-Writer-Wins (LWW) check:
   * Returns true if the incoming write timestamp is newer than or equal to the last applied write.
   * Older writes to the same property are superseded.
   */
  public canApplyLWW(nodeId: string, prop: string, incomingTimestamp?: number): boolean {
    if (incomingTimestamp === undefined || incomingTimestamp === null) return true;
    const key = this.makeKey(nodeId, prop);
    const last = this.appliedOps.get(key);
    if (last && incomingTimestamp < last.timestamp) {
      return false;
    }
    return true;
  }

  /**
   * Record that a property write was successfully applied.
   * Updates last applied timestamp for (nodeId, prop) and clears any pending state.
   */
  public recordApplied(
    nodeId: string,
    prop: string,
    value: unknown,
    timestamp = Date.now()
  ): void {
    const key = this.makeKey(nodeId, prop);
    this.appliedOps.set(key, { nodeId, prop, value, timestamp });
    this.pendingOps.delete(key);
    this.flushDeferred(key);
  }

  /**
   * Defer an operation until pending operations on the same property are resolved.
   */
  public defer(
    nodeId: string,
    prop: string,
    op: PendingOp,
    action: () => Promise<void> | void
  ): void {
    const key = this.makeKey(nodeId, prop);
    this.deferredQueue.push({ key, op, action });
  }

  /**
   * Flush all deferred operations waiting on a specific property key.
   */
  private async flushDeferred(key: string): Promise<void> {
    const matches = this.deferredQueue.filter(d => d.key === key);
    this.deferredQueue = this.deferredQueue.filter(d => d.key !== key);
    for (const item of matches) {
      try {
        await item.action();
      } catch (e) {
        console.error('[Glide PropertyDeltaQueue] Error executing deferred op:', e);
      }
    }
  }

  /**
   * Returns current queue statistics.
   */
  public getStats(): DeltaQueueStats {
    return {
      pendingCount: this.pendingOps.size,
      appliedCount: this.appliedOps.size,
      deferredCount: this.deferredQueue.length
    };
  }

  /**
   * Clear all queue state.
   */
  public clear(): void {
    this.pendingOps.clear();
    this.appliedOps.clear();
    this.deferredQueue = [];
  }
}

export const deltaQueue = new PropertyDeltaQueue();
