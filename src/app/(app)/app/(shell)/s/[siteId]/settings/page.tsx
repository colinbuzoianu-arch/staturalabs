import { redirect } from "next/navigation";

// Stammdaten & Einstellungen landing → its first section (Organisation).
// Users & roles, catalogues beyond hazards, templates, notifications, modules
// and integrations are later additions (§7.11); for now the settings module
// covers the org tree and the hazard catalogue.
export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/settings/org-units`);
}
