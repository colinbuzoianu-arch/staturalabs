import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";

// Authenticated-app gate (SLD_RESTRUCTURE_PLAN_platform-modules.md §5). This
// layout now only guards "signed in at all" — the chrome lives one level down,
// split into two route groups so the P2 migration can proceed one module per
// commit without ever double-wrapping or breaking a page:
//   - (app)/app/(legacy)/  → AppHeader + present shell (pages not yet migrated)
//   - (app)/app/(shell)/   → the registry-driven sidebar shell (migrated pages)
// Both groups are path-transparent, so URLs are unaffected by the grouping.
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser();
  return children;
}
