import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

// Button primitive (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.2). Token-only
// styling — no hex literals — so it tracks the theme in both light and dark.
// Variants map to brand roles: primary = coral accent (the one call to
// action), secondary = outlined on surface, ghost = chromeless, danger = the
// HIGH/destructive status colour.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:brightness-110 border border-transparent",
  secondary:
    "bg-surface text-foreground border border-border hover:border-border-strong",
  ghost:
    "bg-transparent text-foreground border border-transparent hover:bg-surface",
  danger:
    "bg-status-high text-status-fg border border-transparent hover:brightness-110",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0",
        "disabled:opacity-50 disabled:pointer-events-none transition",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
}
