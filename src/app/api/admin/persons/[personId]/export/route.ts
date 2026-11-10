import { exportPerson } from "@/lib/admin/tenant-export";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

// P13 §5 / P7: data-subject export — one person's records across the people
// compartment (super-admin). Encrypted health free-text excluded.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const actor = await requireSuperAdmin();
  const { personId } = await params;
  const data = await exportPerson({ personId, actorUserId: actor.id });
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="statura-person-${personId}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
