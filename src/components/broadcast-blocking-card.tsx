"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// P17 §5 + the broadcast prompt's "workers without e-mail": an access-code
// account has no inbox for a mail to arrive in, so the message has to meet
// them where they actually arrive — the app itself. For those accounts an
// outstanding safety information REPLACES whatever page they asked for, at
// their next sign-in, until they have read and confirmed it.
//
// It is a client component wrapping already-server-rendered children (the same
// "Server Component as a Client Component's children" shape PresentModeShell
// uses) because the one thing it must NOT block is the page where they
// confirm. usePathname lets /app/me/broadcasts/** through; everything else is
// held. usePathname is base-path relative, so this works under /sandbox too.
//
// Deliberately NOT wrapped in <Suspense>: the B6 lesson (CLAUDE.md) is that a
// Suspense boundary makes Next emit the FALLBACK on the server response and
// only swap in the search-param-aware content after hydration — which here
// would mean the blocked page flashing into view.
export function BroadcastBlockingCard({
  items,
  labels,
  children,
}: {
  items: { broadcastId: string; title: string }[];
  labels: { title: string; intro: string; action: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The confirmation surface itself always renders — otherwise the card would
  // be a dead end and the worker could never clear it.
  if (pathname.startsWith("/app/me/broadcasts")) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-status-high bg-surface p-6">
        <h1 className="font-[family-name:var(--font-heading)] text-xl font-bold text-foreground">
          {labels.title}
        </h1>
        <p className="text-sm text-foreground-muted">{labels.intro}</p>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.broadcastId}>
              <Link
                href={`/app/me/broadcasts/${item.broadcastId}`}
                className="block rounded-[var(--radius-md)] bg-accent px-4 py-3 text-center font-medium text-background"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-foreground-subtle">{labels.action}</p>
      </div>
    </div>
  );
}
