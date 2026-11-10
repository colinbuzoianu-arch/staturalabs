import { exportCompany } from "@/lib/admin/tenant-export";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

// P13 §5: full structured tenant export (super-admin). JSON download.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const actor = await requireSuperAdmin();
  const { companyId } = await params;
  const data = await exportCompany({ companyId, actorUserId: actor.id });
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="statura-company-${companyId}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
