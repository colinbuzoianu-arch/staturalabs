// P14 G6: the pure state logic for an offline quick-capture queue — floor staff
// capture an Ereignis-Schnellmeldung (quick incident report) and it is held
// locally until the device is back online, then synced. Pure reducers over an
// array (no DOM, no storage, no network), unit-tested; the client component
// persists the array to localStorage and does the fetch. No app-wide offline
// rewrite — just this one capture flow (plan §G6).
//
// Person-safe: a quick report is a person-free Incident (narrative only); photos,
// when added later, follow the standing "conditions only, no people" rule.

export type QuickIncidentPayload = {
  type: string;
  title: string;
  description: string;
  occurredAt: string; // ISO yyyy-mm-dd
};

export type QueueItemStatus = "pending" | "synced" | "error";

export type QueueItem = {
  // Stable client id — also the idempotency hint so a retry never double-files
  // (the client never re-sends a `synced` item).
  clientKey: string;
  payload: QuickIncidentPayload;
  status: QueueItemStatus;
  attempts: number;
  error?: string;
  createdAt: number;
};

export function enqueue(
  queue: readonly QueueItem[],
  payload: QuickIncidentPayload,
  clientKey: string,
  now: number,
): QueueItem[] {
  return [
    ...queue,
    { clientKey, payload, status: "pending", attempts: 0, createdAt: now },
  ];
}

export function pendingItems(queue: readonly QueueItem[]): QueueItem[] {
  return queue.filter((i) => i.status !== "synced");
}

export function unsyncedCount(queue: readonly QueueItem[]): number {
  return pendingItems(queue).length;
}

export function markSynced(
  queue: readonly QueueItem[],
  clientKey: string,
): QueueItem[] {
  return queue.map((i) =>
    i.clientKey === clientKey
      ? { ...i, status: "synced", error: undefined }
      : i,
  );
}

export function markError(
  queue: readonly QueueItem[],
  clientKey: string,
  error: string,
): QueueItem[] {
  return queue.map((i) =>
    i.clientKey === clientKey
      ? { ...i, status: "error", attempts: i.attempts + 1, error }
      : i,
  );
}

// Drop already-synced items (housekeeping, e.g. keep the local log small).
export function pruneSynced(queue: readonly QueueItem[]): QueueItem[] {
  return queue.filter((i) => i.status !== "synced");
}
