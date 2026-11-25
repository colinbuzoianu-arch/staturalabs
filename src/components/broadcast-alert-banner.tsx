"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// The SAFETY_ALERT banner: prominent, on every page, until the recipient
// confirms it — or dismisses it, which is only offered when NO confirmation is
// required. An alert that demands a confirmation cannot be clicked away;
// that is the point of the priority level.
//
// Dismissal is per viewer and per alert, kept in sessionStorage: it is a
// convenience for the rest of a session, never a record. The record is
// BroadcastRecipient.confirmedAt, written server-side. Every storage access is
// wrapped — a private window or blocked site data must not break the banner.

export type AlertBannerItem = {
  broadcastId: string;
  title: string;
  requiresConfirmation: boolean;
};

const STORAGE_KEY = "sld-dismissed-alerts";

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function BroadcastAlertBanner({
  items,
  labels,
}: {
  items: AlertBannerItem[];
  labels: { title: string; action: string; dismiss: string };
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  // Read storage after mount only: the server render must not depend on it, or
  // the markup would mismatch on hydration.
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const visible = items.filter(
    (i) => i.requiresConfirmation || !dismissed.includes(i.broadcastId),
  );
  if (visible.length === 0) return null;

  function dismiss(broadcastId: string) {
    const next = [...dismissed, broadcastId];
    setDismissed(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — the banner simply reappears next navigation.
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-status-high bg-status-high px-4 py-3 text-status-fg">
      {visible.map((item) => (
        <div
          key={item.broadcastId}
          className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3"
        >
          <span className="font-technical text-xs uppercase tracking-[0.2em]">
            {labels.title}
          </span>
          <span className="font-heading text-sm font-bold">{item.title}</span>
          <Link
            href={`/app/me/broadcasts/${item.broadcastId}`}
            className="rounded-[var(--radius-md)] bg-status-fg/15 px-3 py-1 text-xs font-medium underline"
          >
            {labels.action}
          </Link>
          {!item.requiresConfirmation && (
            <button
              type="button"
              onClick={() => dismiss(item.broadcastId)}
              className="text-xs underline opacity-80"
            >
              {labels.dismiss}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
