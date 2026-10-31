import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

// Form field primitives (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.2:
// input, select, textarea, checkbox, label). Token-only; focus ring from the
// accent. Native <select> for now — the richer combobox/date-picker are
// proposed on Radix (see the design showcase's dependency note), not built
// here pre-approval.

const CONTROL =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm text-foreground " +
  "placeholder:text-foreground-subtle outline-none focus-visible:border-border-strong " +
  "focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50";

export function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-medium text-foreground-muted"
    >
      {children}
    </label>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(CONTROL, "min-h-20 py-2", className)} {...props} />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "h-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 text-sm text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded-[var(--radius-sm)] border-border accent-[var(--accent)]"
        {...props}
      />
      {label}
    </label>
  );
}
