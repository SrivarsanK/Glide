import { describe, expect, test, beforeEach } from 'vitest';
import { PropertyDeltaQueue } from '../../packages/server/src/delta-queue.js';

describe('PropertyDeltaQueue (Property-Level LWW Conflict Resolver)', () => {
  let queue: PropertyDeltaQueue;

  beforeEach(() => {
    queue = new PropertyDeltaQueue();
  });

  test('should enqueue in-flight operations and retrieve them by node and property', () => {
    const opId = queue.enqueuePending('src/App.tsx:10:5', 'width', 200, 'client-1');

    expect(opId).toBeDefined();
    expect(queue.hasPending('src/App.tsx:10:5', 'width')).toBe(true);

    const pending = queue.getPending('src/App.tsx:10:5', 'width');
    expect(pending?.nodeId).toBe('src/App.tsx:10:5');
    expect(pending?.prop).toBe('width');
    expect(pending?.value).toBe(200);
    expect(pending?.clientId).toBe('client-1');

    // Distinct property on same node should not have pending op
    expect(queue.hasPending('src/App.tsx:10:5', 'backgroundColor')).toBe(false);
  });

  test('should ack pending operations by node and prop', () => {
    queue.enqueuePending('src/App.tsx:10:5', 'height', 150);
    expect(queue.hasPending('src/App.tsx:10:5', 'height')).toBe(true);

    const removed = queue.ackPending('src/App.tsx:10:5', 'height');
    expect(removed).toBe(true);
    expect(queue.hasPending('src/App.tsx:10:5', 'height')).toBe(false);
  });

  test('should ack pending operations by opId', () => {
    const opId = queue.enqueuePending('src/App.tsx:10:5', 'padding', '12px');
    expect(queue.hasPending('src/App.tsx:10:5', 'padding')).toBe(true);

    const removed = queue.ackOpId(opId);
    expect(removed).toBe(true);
    expect(queue.hasPending('src/App.tsx:10:5', 'padding')).toBe(false);
  });

  test('should enforce property-level Last-Writer-Wins (LWW)', () => {
    const t1 = 1000;
    const t2 = 2000;
    const t3 = 1500; // Older than t2!

    // Record t1 write
    queue.recordApplied('node-1', 'width', 100, t1);
    expect(queue.canApplyLWW('node-1', 'width', t2)).toBe(true);

    // Record t2 write
    queue.recordApplied('node-1', 'width', 200, t2);

    // Incoming t3 (1500) is older than t2 (2000), should be rejected under LWW
    expect(queue.canApplyLWW('node-1', 'width', t3)).toBe(false);

    // Newer t4 (2500) should be accepted
    expect(queue.canApplyLWW('node-1', 'width', 2500)).toBe(true);
  });

  test('concurrent edits to different properties of same node do NOT conflict', () => {
    const tWidth = 1000;
    const tColor = 500;

    queue.recordApplied('node-1', 'width', 300, tWidth);

    // backgroundColor timestamp (500) is independent of width timestamp (1000)
    expect(queue.canApplyLWW('node-1', 'backgroundColor', tColor)).toBe(true);
    queue.recordApplied('node-1', 'backgroundColor', '#ff0000', tColor);

    // Verify stats show 2 distinct applied properties
    const stats = queue.getStats();
    expect(stats.appliedCount).toBe(2);
  });

  test('should defer execution and flush on ack', async () => {
    queue.enqueuePending('node-1', 'opacity', 0.5);

    let executed = false;
    queue.defer('node-1', 'opacity', {
      opId: 'op-deferred',
      nodeId: 'node-1',
      prop: 'opacity',
      value: 1.0,
      timestamp: Date.now()
    }, () => {
      executed = true;
    });

    expect(executed).toBe(false);
    expect(queue.getStats().deferredCount).toBe(1);

    // Acknowledge the pending op -> triggers flush
    queue.ackPending('node-1', 'opacity');

    // Allow promise tick
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(executed).toBe(true);
    expect(queue.getStats().deferredCount).toBe(0);
  });

  test('should clear queue state on clear()', () => {
    queue.enqueuePending('node-1', 'width', 100);
    queue.recordApplied('node-1', 'height', 200);

    expect(queue.getStats().pendingCount).toBe(1);
    expect(queue.getStats().appliedCount).toBe(1);

    queue.clear();

    expect(queue.getStats().pendingCount).toBe(0);
    expect(queue.getStats().appliedCount).toBe(0);
    expect(queue.getStats().deferredCount).toBe(0);
  });
});
