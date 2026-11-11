"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enqueue,
  markError,
  markSynced,
  pendingItems,
  pruneSynced,
  type QueueItem,
} from "@/lib/offline/quick-capture-queue";

type QuickDict = {
  onlineLabel: string;
  offlineLabel: string;
  typeLabel: string;
  titleLabel: string;
  descriptionLabel: string;
  dateLabel: string;
  captureButton: string;
  queuedHeading: string;
  syncNow: string;
  clearSynced: string;
  noPeopleNotice: string;
  pendingBadge: string;
  errorBadge: string;
  syncedBadge: string;
  emptyQueue: string;
  savedOfflineMsg: string;
};

const ISO_TODAY = () => new Date().toISOString().slice(0, 10);

export function QuickCaptureClient({
  siteId,
  types,
  typeLabels,
  dict,
}: {
  siteId: string;
  types: string[];
  typeLabels: Record<string, string>;
  dict: QuickDict;
}) {
  const storageKey = `statura-quick-incidents-${siteId}`;
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [online, setOnline] = useState(true);
  const [type, setType] = useState(types[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(ISO_TODAY());
  const [saved, setSaved] = useState(false);

  // Persist helper.
  const persist = useCallback(
    (next: QueueItem[]) => {
      setQueue(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable (private mode / blocked) — in-memory only.
      }
    },
    [storageKey],
  );

  // Load persisted queue + wire online/offline.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setQueue(JSON.parse(raw) as QueueItem[]);
    } catch {
      // ignore
    }
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [storageKey]);

  // Sync every pending item that hasn't synced yet. Reads the freshest queue
  // from storage (not the state closure), so this callback is stable across
  // queue changes and the online-transition effect below never loops.
  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    let current: QueueItem[];
    try {
      const raw = localStorage.getItem(storageKey);
      current = raw ? (JSON.parse(raw) as QueueItem[]) : [];
    } catch {
      current = [];
    }
    for (const item of pendingItems(current)) {
      try {
        const res = await fetch(`/api/sites/${siteId}/quick-incident`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        current = res.ok
          ? markSynced(current, item.clientKey)
          : markError(current, item.clientKey, `HTTP ${res.status}`);
      } catch (e) {
        current = markError(
          current,
          item.clientKey,
          e instanceof Error ? e.message : "network",
        );
      }
      persist(current);
    }
  }, [siteId, persist, storageKey]);

  // Auto-sync when we come back online.
  useEffect(() => {
    if (online) void sync();
  }, [online, sync]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0 || description.trim().length === 0) return;
    const clientKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const next = enqueue(
      queue,
      { type, title, description, occurredAt: date },
      clientKey,
      Date.now(),
    );
    persist(next);
    setTitle("");
    setDescription("");
    setDate(ISO_TODAY());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    void sync();
  };

  const visible = pendingItems(queue);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
            online
              ? "bg-status-low/15 text-status-low"
              : "bg-status-high/15 text-status-high"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${online ? "bg-status-low" : "bg-status-high"}`}
          />
          {online ? dict.onlineLabel : dict.offlineLabel}
        </span>
      </div>

      <p className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-xs text-foreground-muted">
        {dict.noPeopleNotice}
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          {dict.typeLabel}
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1.5"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t] ?? t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {dict.titleLabel}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="rounded border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          {dict.descriptionLabel}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            className="rounded border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          {dict.dateLabel}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44 rounded border border-border bg-background px-2 py-1.5"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
          >
            {dict.captureButton}
          </button>
          {saved ? (
            <span className="text-xs text-status-low">
              {dict.savedOfflineMsg}
            </span>
          ) : null}
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-bold">
            {dict.queuedHeading} ({visible.length})
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void sync()}
              disabled={!online || visible.length === 0}
              className="rounded border border-border px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
            >
              {dict.syncNow}
            </button>
            <button
              type="button"
              onClick={() => persist(pruneSynced(queue))}
              className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
            >
              {dict.clearSynced}
            </button>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-foreground-subtle">{dict.emptyQueue}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {visible.map((item) => (
              <li
                key={item.clientKey}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {item.payload.title}
                  </span>
                  <span className="text-xs text-foreground-subtle">
                    {typeLabels[item.payload.type] ?? item.payload.type} ·{" "}
                    {item.payload.occurredAt}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-xs ${
                    item.status === "error"
                      ? "text-status-high"
                      : "text-foreground-subtle"
                  }`}
                >
                  {item.status === "error"
                    ? dict.errorBadge
                    : dict.pendingBadge}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
