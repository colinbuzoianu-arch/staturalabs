import { describe, expect, it } from "vitest";
import {
  enqueue,
  markError,
  markSynced,
  pruneSynced,
  type QueueItem,
  unsyncedCount,
} from "./quick-capture-queue";

const payload = {
  type: "BEINAHEUNFALL",
  title: "x",
  description: "y",
  occurredAt: "2026-05-01",
};

describe("quick-capture queue", () => {
  it("enqueues a pending item", () => {
    const q = enqueue([], payload, "k1", 1);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({
      clientKey: "k1",
      status: "pending",
      attempts: 0,
    });
    expect(unsyncedCount(q)).toBe(1);
  });

  it("marks an item synced and stops counting it as unsynced", () => {
    let q = enqueue([], payload, "k1", 1);
    q = markSynced(q, "k1");
    expect(q[0].status).toBe("synced");
    expect(unsyncedCount(q)).toBe(0);
  });

  it("marks an item error and increments attempts, still unsynced", () => {
    let q = enqueue([], payload, "k1", 1);
    q = markError(q, "k1", "offline");
    expect(q[0]).toMatchObject({
      status: "error",
      attempts: 1,
      error: "offline",
    });
    expect(unsyncedCount(q)).toBe(1);
  });

  it("prunes only synced items", () => {
    let q: QueueItem[] = enqueue([], payload, "k1", 1);
    q = enqueue(q, payload, "k2", 2);
    q = markSynced(q, "k1");
    const pruned = pruneSynced(q);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].clientKey).toBe("k2");
  });
});
