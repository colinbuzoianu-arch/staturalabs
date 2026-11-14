import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { TrainingConfirmation } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  cancelTrainingSession,
  completeTrainingSession,
} from "@/lib/people/training";
import { prisma } from "@/lib/prisma";

// P17 §4: a training session's attendance capture. PLANNED → record who
// attended (+ signed) → COMPLETED (TrainingRecords created in the lib gate).
export default async function TrainingSessionDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; sessionId: string }>;
}) {
  const { siteId, sessionId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).trainingSessionsPage;
  const companyId = site.companyId;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      companyId: true,
      date: true,
      location: true,
      instructor: true,
      status: true,
      requirementType: { select: { title: true } },
      participants: {
        orderBy: { person: { lastName: "asc" } },
        select: {
          personId: true,
          status: true,
          signatureConfirmed: true,
          person: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!session || session.companyId !== companyId) notFound();

  const isPlanned = session.status === "PLANNED";

  async function completeAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const current = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: {
        companyId: true,
        participants: { select: { personId: true } },
      },
    });
    if (!current || current.companyId !== s.companyId) notFound();
    const confirmationRaw = formData.get("confirmation");
    const confirmation: TrainingConfirmation =
      confirmationRaw === "SELF_CONFIRMED" ? "SELF_CONFIRMED" : "SIGNATURE";
    const attendance = current.participants.map((p) => ({
      personId: p.personId,
      attended: formData.get(`attended:${p.personId}`) === "on",
      signatureConfirmed: formData.get(`signed:${p.personId}`) === "on",
    }));
    await completeTrainingSession({
      trainingSessionId: sessionId,
      companyId: s.companyId,
      attendance,
      confirmation,
      actorUserId: actor.id,
    });
    revalidatePath(`/app/s/${siteId}/training/sessions/${sessionId}`);
    redirect(`/app/s/${siteId}/training/sessions/${sessionId}`);
  }

  async function cancelAction() {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    await cancelTrainingSession({
      trainingSessionId: sessionId,
      companyId: s.companyId,
      actorUserId: actor.id,
    });
    revalidatePath(`/app/s/${siteId}/training/sessions/${sessionId}`);
    redirect(`/app/s/${siteId}/training/sessions/${sessionId}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link
          className="text-sm text-info hover:underline"
          href={`/app/s/${siteId}/training/sessions`}
        >
          {dict.backToList}
        </Link>
      </div>
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-border">
          {dict.detailHeading}
        </p>
        <h1 className="font-heading text-2xl font-bold">
          {session.requirementType.title}
        </h1>
        <p className="text-sm text-foreground/80">
          {session.date.toISOString().slice(0, 10)} · {session.instructor}
          {session.location ? ` · ${session.location}` : ""} ·{" "}
          {dict.statusLabels[session.status as keyof typeof dict.statusLabels]}
        </p>
        <Link
          className="text-sm text-info hover:underline"
          href={`/api/training-sessions/${sessionId}/attendance`}
        >
          {dict.pdfLink}
        </Link>
      </header>

      {!isPlanned && (
        <p className="rounded bg-surface p-2 text-sm">
          {session.status === "COMPLETED"
            ? dict.completedNote
            : dict.cancelledNote}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">{dict.rosterHeading}</h2>
        {isPlanned ? (
          <form action={completeAction} className="flex flex-col gap-3">
            <label className="flex w-fit flex-col gap-1 text-sm">
              {dict.confirmationLabel}
              <select
                name="confirmation"
                className="rounded border border-border bg-background p-2"
              >
                <option value="SIGNATURE">{dict.confirmationSignature}</option>
                <option value="SELF_CONFIRMED">{dict.confirmationSelf}</option>
              </select>
            </label>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1 pr-4">—</th>
                  <th className="py-1 pr-4">{dict.attendedLabel}</th>
                  <th className="py-1 pr-4">{dict.signatureLabel}</th>
                </tr>
              </thead>
              <tbody>
                {session.participants.map((p) => (
                  <tr
                    key={p.personId}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1 pr-4">
                      {p.person.lastName}, {p.person.firstName}
                    </td>
                    <td className="py-1 pr-4">
                      <input
                        type="checkbox"
                        name={`attended:${p.personId}`}
                        defaultChecked
                      />
                    </td>
                    <td className="py-1 pr-4">
                      <input type="checkbox" name={`signed:${p.personId}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
              >
                {dict.completeButton}
              </button>
            </div>
          </form>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">—</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1 pr-4">{dict.signatureLabel}</th>
              </tr>
            </thead>
            <tbody>
              {session.participants.map((p) => (
                <tr
                  key={p.personId}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">
                    {p.person.lastName}, {p.person.firstName}
                  </td>
                  <td className="py-1 pr-4">{p.status}</td>
                  <td className="py-1 pr-4">
                    {p.signatureConfirmed ? "✓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isPlanned && (
        <form action={cancelAction}>
          <button
            type="submit"
            className="rounded border border-status-high/50 px-3 py-1.5 text-sm text-status-high hover:bg-status-high/10"
          >
            {dict.cancelButton}
          </button>
        </form>
      )}
    </div>
  );
}
