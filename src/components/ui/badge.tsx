import type { ReactNode } from "react";
import { cn } from "./cn";

// Status chip (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.2 — "badge/status
// chip, generated from enums"). One `tone` scale backs every enum badge so
// RiskBand, check states, action status and severity speak one visual
// vocabulary. Solid-fill tones use white text (theme-independent AA);
// `neutral` and `outline` read against the page.
export type BadgeTone =
  | "low"
  | "moderate"
  | "elevated"
  | "high"
  | "info"
  | "neutral"
  | "outline";

const TONE: Record<BadgeTone, string> = {
  low: "bg-status-low text-status-fg",
  moderate: "bg-status-moderate text-status-fg",
  elevated: "bg-status-elevated text-status-fg",
  high: "bg-status-high text-status-fg",
  info: "bg-status-info text-status-fg",
  neutral: "bg-status-neutral text-status-fg",
  outline: "bg-transparent text-foreground-muted border border-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Enum → tone maps. These are presentation, not scoring — the ranking in
// src/lib/risk/band-severity.ts stays the one that feeds decisions. RiskBand
// stays an untranslated enum everywhere per §6's one-vocabulary rule; the
// label shown is the raw value, the colour comes from here.
export const RISK_BAND_TONE: Record<string, BadgeTone> = {
  LOW: "low",
  MODERATE: "moderate",
  ELEVATED: "elevated",
  HIGH: "high",
};

export const CATEGORY_CHECK_TONE: Record<string, BadgeTone> = {
  OPEN: "outline",
  CHECKED_NO_HAZARD: "low",
  NOT_APPLICABLE: "neutral",
  HAZARD_PRESENT: "high",
};

export const ACTION_STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: "outline",
  IN_PROGRESS: "info",
  IMPLEMENTED: "moderate",
  VERIFIED: "low",
  CANCELLED: "neutral",
};

export const ASSESSMENT_STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: "outline",
  IN_REVIEW: "info",
  APPROVED: "low",
  ARCHIVED: "neutral",
};
