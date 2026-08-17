// SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B6: a presentation flag on
// views that already exist and already pass requireSiteAccess — no new
// data paths, no new authorization. One shared constant so every page
// checks/sets the same query param name.
export const PRESENT_MODE_PARAM = "present";
export const PRESENT_MODE_VALUE = "1";

export function isPresentMode(value: string | undefined): boolean {
  return value === PRESENT_MODE_VALUE;
}

export function withPresentMode(path: string, extra?: string): string {
  const query = `${PRESENT_MODE_PARAM}=${PRESENT_MODE_VALUE}${extra ? `&${extra}` : ""}`;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}
