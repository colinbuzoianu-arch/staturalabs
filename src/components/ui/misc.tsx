// biome-ignore-all lint/suspicious/noArrayIndexKey: fixed-order presentational lists (columns config, static timeline)
import type { ReactNode } from "react";
import { cn } from "./cn";

// Smaller presentational primitives grouped in one file for the P2 proposal:
// Progress, EmptyState, Timeline. Each is token-only.

// Progress bar — used by the hub's completeness meter (x of 13 categories).
export function Progress({
  value,
  max = 100,
  tone = "accent",
  className,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "low" | "high";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill =
    tone === "low"
      ? "bg-status-low"
      : tone === "high"
        ? "bg-status-high"
        : "bg-accent";
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-sunken",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div
        className={cn("h-full rounded-full transition-all", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Empty state — the honest "nothing here yet" panel every list/module reuses.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-10 text-center">
      <p className="font-[family-name:var(--font-heading)] text-sm font-semibold text-foreground">
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-sm text-foreground-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export type TimelineItem = {
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  connector?: ReactNode;
};

// Timeline — the verification-loop pattern (§5.2 / the workstation risk
// page's assessment history). A vertical rail with a node per entry and an
// optional connector note between consecutive entries.
export function Timeline({ items }: { items: readonly TimelineItem[] }) {
  return (
    <ol className="relative ml-2 border-l border-border">
      {items.map((item, i) => (
        <li key={i} className="mb-5 ml-5 last:mb-0">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
          <div className="text-sm font-medium text-foreground">
            {item.title}
          </div>
          {item.meta ? (
            <div className="text-xs text-foreground-subtle">{item.meta}</div>
          ) : null}
          {item.body ? (
            <div className="mt-1 text-sm text-foreground-muted">
              {item.body}
            </div>
          ) : null}
          {item.connector ? (
            <div className="mt-2 rounded-[var(--radius-md)] border border-border bg-surface-sunken px-3 py-1.5 text-xs text-foreground-muted">
              {item.connector}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
