import { redirect } from "next/navigation";

// /app is the authenticated app root (SLD_RESTRUCTURE_PLAN_platform-modules.md
// §2.3). For now it sends the user to the site list; once the cockpit +
// last-used-site memory land (P4), this becomes "last-used site cockpit".
export default function AppIndexPage() {
  redirect("/app/sites");
}
