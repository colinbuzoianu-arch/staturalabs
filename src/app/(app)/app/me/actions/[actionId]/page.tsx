import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTION_STATUS_TONE, Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionStatus } from "@/generated/prisma/enums";
import { ACTION_STATUS_TRANSITIONS, transitionAction } from "@/lib/action";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P17 §5: an employee's view of an action assigned to THEM personally, with the
// limited transitions they may drive (no verify, no cancel — those belong to
// EHS/the leader). Gate: Action.responsibleUserId must equal the signed-in
// user; otherwise 404 (same fail-closed, don't-confirm-existence posture as
// requireTaskAccess). This is the self-scoped door — an employee has no site
// access, so the full /app/s/.../actions/[id] page 404s for them.
const EMPLOYEE_FORBIDDEN: ReadonlySet<ActionStatus> = new Set([
  ActionStatus.VERIFIED,
  ActionStatus.CANCELLED,
]);

export default async function MyActionPage({
  params,
}: {
  params: Promise<{ actionId: string }>;
}) {
  const { actionId } = await params;
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;
  const dict = getAdministrationDictionary(locale).myTasks;

  const action = await prisma.action.findUnique({ where: { id: actionId } });
  if (!action || action.responsibleUserId !== user.id) notFound();

  const nextStatuses = (ACTION_STATUS_TRANSITIONS[action.status] ?? []).filter(
    (s) => !EMPLOYEE_FORBIDDEN.has(s),
  );

  async function transitionSelfAction(formData: FormData) {
    "use server";
    const u = await requireAuthenticatedUser();
    const toStatus = String(formData.get("toStatus") ?? "") as ActionStatus;
    const current = await prisma.action.findUnique({
      where: { id: actionId },
      select: { responsibleUserId: true, status: true },
    });
    if (!current || current.responsibleUserId !== u.id) notFound();
    // Re-enforce the employee restriction server-side (the buttons already
    // exclude verify/cancel, but a Server Action runs as its own request).
    if (EMPLOYEE_FORBIDDEN.has(toStatus)) notFound();
    const legal = ACTION_STATUS_TRANSITIONS[current.status] ?? [];
    if (!legal.includes(toStatus)) notFound();
    await transitionAction({ actionId, toStatus, byUserId: u.id });
    revalidatePath(`/app/me/actions/${actionId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/app/me"
        className="text-sm text-foreground-muted hover:text-accent"
      >
        ← {dict.heading}
      </Link>

      <Card>
        <CardHeader title={action.title} />
        <CardBody>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={ACTION_STATUS_TONE[action.status] ?? "neutral"}>
              {statusLabels[action.status]}
            </Badge>
            {action.dueDate && (
              <span className="text-sm text-foreground-subtle">
                {dict.dueLabel} {action.dueDate.toISOString().slice(0, 10)}
              </span>
            )}
          </div>
          {action.description && (
            <p className="whitespace-pre-wrap text-sm text-foreground-muted">
              {action.description}
            </p>
          )}

          {nextStatuses.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {nextStatuses.map((s) => (
                <form key={s} action={transitionSelfAction}>
                  <input type="hidden" name="toStatus" value={s} />
                  <button
                    type="submit"
                    className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised"
                  >
                    {statusLabels[s]}
                  </button>
                </form>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
