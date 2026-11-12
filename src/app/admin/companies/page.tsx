import { redirect } from "next/navigation";

// The tenant list moved to /admin/tenants (styled console). This stub keeps
// old bookmarks/links working. The per-company sites CRUD still lives under
// /admin/companies/[companyId]/sites and is linked from the tenant detail.
export default function CompaniesRedirect() {
  redirect("/admin/tenants");
}
