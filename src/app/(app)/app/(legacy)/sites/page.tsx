import { redirect } from "next/navigation";

// The standalone site chooser was removed — a signed-in user now lands
// directly on a site cockpit and switches location from the sidebar. This
// stub keeps old /app/sites links/bookmarks working by forwarding to the
// landing resolver (/app).
export default function SitesChooserRedirect() {
  redirect("/app");
}
