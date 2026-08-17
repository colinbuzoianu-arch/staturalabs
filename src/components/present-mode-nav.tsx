"use client";

import { useEffect } from "react";

// The keyboard ←/→ half of §7 B6's present mode — rendered only on pages
// already in present mode, with a prev/next href each page computes from
// data it already fetched for its normal (non-present) rendering (see the
// comments at each call site for exactly which existing fields feed this —
// no new queries, per the plan's explicit instruction). Plain <a> rather
// than next/link since some targets are Route Handlers (the SGD PDF), not
// pages — a uniform full navigation works for both.
export function PresentModeNav({
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: {
  prevHref: string | null;
  nextHref: string | null;
  prevLabel: string;
  nextLabel: string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" && nextHref) {
        window.location.assign(nextHref);
      } else if (event.key === "ArrowLeft" && prevHref) {
        window.location.assign(prevHref);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevHref, nextHref]);

  if (!prevHref && !nextHref) return null;

  return (
    <nav className="flex items-center justify-between gap-4 text-sm">
      {prevHref ? (
        <a
          href={prevHref}
          className="rounded border border-border px-3 py-1 hover:border-accent"
        >
          ← {prevLabel}
        </a>
      ) : (
        <span />
      )}
      {nextHref ? (
        <a
          href={nextHref}
          className="rounded border border-border px-3 py-1 hover:border-accent"
        >
          {nextLabel} →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
