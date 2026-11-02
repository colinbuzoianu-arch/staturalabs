import { twMerge } from "tailwind-merge";

// Class-name joiner with Tailwind conflict de-duplication (tailwind-merge,
// founder-approved on the P2 review): later classes win over earlier
// conflicting ones (e.g. a caller's `px-6` overrides a primitive's `px-4`),
// which is exactly what a `className` override prop should do. Falsy values
// are dropped.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
