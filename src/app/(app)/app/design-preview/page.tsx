import { notFound } from "next/navigation";
import { DesignShowcase } from "./design-showcase";

// Dev-only design-system + sidebar proposal (SLD_RESTRUCTURE_PLAN_platform-
// modules.md §5, P2 phase 1). Never shipped: 404s in production. It renders a
// token reference, the primitive gallery, the registry-driven sidebar in its
// three states, and three page mockups, for founder review BEFORE the real
// shell is built and pages are migrated into it.
//
// Served at /app/design-preview, not the plan's /app/_design: Next.js treats a
// leading-underscore folder as a private (non-routable) folder, so `_design`
// can never be a URL. Same dev-only intent, routable name.
export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignShowcase />;
}
