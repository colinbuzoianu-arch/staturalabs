"use client";

import { usePathname, useSearchParams } from "next/navigation";

// A single, always-reachable way out of present mode — strips every
// present-mode query param (present/step/from/actionId/workstationId),
// leaving the page's own identity (e.g. ?planId=) intact.
export function PresentModeExitBar({ exitLabel }: { exitLabel: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  for (const key of ["present", "step", "from", "actionId", "workstationId"]) {
    params.delete(key);
  }
  const query = params.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <a
        href={href}
        className="rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-lg hover:border-accent"
      >
        {exitLabel}
      </a>
    </div>
  );
}
