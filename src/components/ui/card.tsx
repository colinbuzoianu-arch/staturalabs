import type { ReactNode } from "react";
import { cn } from "./cn";

// Card/panel (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.2). The raised
// surface for grouped content — one elevation step above the page.
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface-raised",
        "shadow-[var(--elevation-1)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div>
        <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-sm text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
