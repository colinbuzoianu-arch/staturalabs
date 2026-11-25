import type { ReactNode } from "react";
import { requireModuleAccess } from "@/lib/auth/require-access";

// P17 §2 (slice 8): one module guard for every page and nested route under
// this module — site access alone is not enough, the role's bundle must carry
// the module's permission (override-aware). See requireModuleAccess.
export default async function CalendarModuleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireModuleAccess("CALENDAR", siteId);
  return children;
}
