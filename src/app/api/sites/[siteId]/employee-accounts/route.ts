import { hasPermission } from "@/lib/auth/permissions";
import { canAccessCompany } from "@/lib/auth/rbac";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { provisionEmployeeAccounts } from "@/lib/people/employee-account";

// P17 §5 bulk provisioning. A POST route rather than a Server Action because
// the result contains the one-time access codes, which are shown ONCE and
// never stored in plaintext — the client needs them back in the response to
// render the printable hand-over sheet. (A Server Action's redirect/revalidate
// shape would have meant either putting secrets in a URL or persisting them.)
//
// Gated exactly like the Personen register plus a company-scope check:
// granting a login is company-level (§2 "Users & roles"), so a site_admin
// confined to one site cannot provision accounts.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  if (!hasPermission(user, "people.write")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!canAccessCompany(user, site.companyId)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>).personIds;
  const personIds = Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  if (personIds.length === 0) {
    return Response.json({ error: "no-persons" }, { status: 400 });
  }
  if (personIds.length > 200) {
    return Response.json({ error: "too-many" }, { status: 400 });
  }

  // Company membership of each person is re-checked inside the gate (it skips
  // with "not-found" for anything outside this company), so nothing here can
  // reach another tenant.
  const outcomes = await provisionEmployeeAccounts({
    companyId: site.companyId,
    personIds,
    actorUserId: user.id,
  });

  return Response.json({ outcomes }, { status: 200 });
}
