// Minimal class-name joiner. Deliberately not pulling in clsx/tailwind-merge
// for P2's proposal — if the founder approves a utility dependency on review
// this can be swapped for tailwind-merge (which also de-dupes conflicting
// Tailwind classes). Falsy values are dropped; that's all the primitives need.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
