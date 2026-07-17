export const PILOT_MAILTO = "mailto:contact@verumsell.com";

// Shared responsive floor for the whole page (header collapse, every
// multi-column section stacking to one column) — a fixed value, not one of
// Tailwind's default breakpoints, so it's centralized here and applied via
// arbitrary-value breakpoint classes (e.g. `min-[860px]:grid-cols-4`)
// rather than a new global Tailwind breakpoint just for this page.
export const DESKTOP_BREAKPOINT_PX = 860;
