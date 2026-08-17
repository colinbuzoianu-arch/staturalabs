"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { isPresentMode } from "@/lib/present-mode";
import { PresentModeExitBar } from "./present-mode-exit-bar";

// SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B6: "hide the app chrome,
// raise base type size, high contrast." AppHeader/AppFooter are rendered
// server-side by (app)/layout.tsx and passed in as already-built elements
// (the standard "Server Component as a Client Component's children/props"
// pattern) — this component only ever decides whether to show them, it
// never imports server-only code itself.
//
// Deliberately NOT wrapped in <Suspense>: this layout is already fully
// dynamic (requireAuthenticatedUser reads cookies), so there is no static-
// rendering benefit to gain from a Suspense boundary here — and adding one
// anyway was a real bug, caught live: Suspense makes Next.js emit the
// fallback on the very first server-rendered response and swap in the
// real (search-param-aware) content only after client hydration, so the
// normal chrome was what actually shipped in the initial HTML regardless
// of `?present=1`. Without Suspense, useSearchParams() reads the correct
// value on the real SSR pass, no flash.
export function PresentModeShell({
  children,
  header,
  footer,
  exitLabel,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  exitLabel: string;
}) {
  const searchParams = useSearchParams();
  const presentMode = isPresentMode(searchParams.get("present") ?? undefined);

  if (presentMode) {
    return (
      <div className="flex min-h-full flex-col bg-background text-lg text-foreground contrast-125 [&_h1]:text-4xl [&_h2]:text-2xl">
        <main className="flex-1 px-6 py-10">{children}</main>
        <PresentModeExitBar exitLabel={exitLabel} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </div>
  );
}
