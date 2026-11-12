"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

// Client-driven module entitlement toggle with explicit feedback: while the
// server action runs it shows "Saving…", and on success a short-lived
// "Saved ✓" (aria-live) — so a super-admin gets confirmation the change
// persisted instead of a silent instant toggle. `action` is a server action
// (key, enable) => Promise<void>; the matrix binds companyId into it.
type Labels = {
  enable: string;
  disable: string;
  saving: string;
  saved: string;
};

export function EntitlementToggle({
  appearance,
  on,
  moduleKey,
  disabled = false,
  labels,
  action,
}: {
  appearance: "button" | "cell";
  on: boolean;
  moduleKey: string;
  disabled?: boolean;
  labels: Labels;
  action: (key: string, enable: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle() {
    setSaved(false);
    startTransition(async () => {
      await action(moduleKey, !on);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  if (appearance === "cell") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        aria-pressed={on}
        aria-label={on ? labels.disable : labels.enable}
        title={pending ? labels.saving : saved ? labels.saved : undefined}
        className={cn(
          "grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] border text-[10px] transition",
          on
            ? "border-transparent bg-accent text-white"
            : "border-border text-foreground-subtle hover:border-border-strong",
          (disabled || pending) && "opacity-60",
        )}
      >
        {pending ? "…" : on ? <Check size={14} aria-hidden /> : ""}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span
        aria-live="polite"
        className={cn(
          "text-xs",
          pending ? "text-foreground-subtle" : "text-status-low",
        )}
      >
        {pending ? labels.saving : saved ? labels.saved : ""}
      </span>
      <Button
        type="button"
        size="sm"
        variant={on ? "secondary" : "primary"}
        disabled={disabled || pending}
        onClick={toggle}
      >
        {on ? labels.disable : labels.enable}
      </Button>
    </span>
  );
}
