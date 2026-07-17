import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssessmentMode } from "@/generated/prisma/enums";
import { createAssessmentSession } from "@/lib/assessment-session";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const MODE_OPTIONS = Object.values(AssessmentMode);

// super_admin-only, like the rest of /admin. This is also the first real
// caller of createAssessmentSession() (src/lib/assessment-session.ts) —
// picking CONTINUOUS here throws (not yet implemented, see mandate 3.11),
// same as it would from any other caller; no special-casing in this page.
//
// pilotContext is shown/settable here and nowhere else: internal-only
// audit-trail metadata (§3.6), deliberately not surfaced in the customer-
// facing dashboard (src/app/(app)/**) — see the schema.prisma doc comment.
export default async function SessionsPage({
  params,
}: {
  params: Promise<{ workstationId: string }>;
}) {
  await requireSuperAdmin();
  const { workstationId } = await params;

  const workstation = await prisma.workstation.findUnique({
    where: { id: workstationId },
    include: { site: { include: { company: true } } },
  });
  if (!workstation) notFound();

  async function createSession(formData: FormData) {
    "use server";
    await requireSuperAdmin();

    const startedAtRaw = formData.get("startedAt");
    if (typeof startedAtRaw !== "string" || startedAtRaw.trim().length === 0) {
      throw new Error("Started at is required");
    }
    const startedAt = new Date(startedAtRaw);
    if (Number.isNaN(startedAt.getTime())) {
      throw new Error("Started at must be a valid date/time");
    }

    const endedAtRaw = formData.get("endedAt");
    const endedAt =
      typeof endedAtRaw === "string" && endedAtRaw.trim().length > 0
        ? new Date(endedAtRaw)
        : null;

    const modeRaw = formData.get("mode");
    if (
      typeof modeRaw !== "string" ||
      !(Object.values(AssessmentMode) as string[]).includes(modeRaw)
    ) {
      throw new Error(`mode must be one of ${MODE_OPTIONS.join(", ")}`);
    }

    const pilotContextRaw = formData.get("pilotContext");
    const pilotContext =
      typeof pilotContextRaw === "string" && pilotContextRaw.trim().length > 0
        ? pilotContextRaw.trim()
        : null;

    const notesRaw = formData.get("notes");
    const notes =
      typeof notesRaw === "string" && notesRaw.trim().length > 0
        ? notesRaw.trim()
        : null;

    await createAssessmentSession({
      workstationId,
      startedAt,
      endedAt,
      mode: modeRaw as AssessmentMode,
      pilotContext,
      notes,
    });
    revalidatePath(`/admin/workstations/${workstationId}/sessions`);
  }

  const sessions = await prisma.assessmentSession.findMany({
    where: { workstationId },
    orderBy: { startedAt: "desc" },
  });

  const locale = await getLocale();
  const dict = getAdminDictionary(locale).sessionsPage;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link href="/admin/companies" className="underline">
          {dict.companiesBreadcrumb}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/companies/${workstation.site.companyId}/sites`}
          className="underline"
        >
          {workstation.site.company.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/sites/${workstation.siteId}/workstations`}
          className="underline"
        >
          {workstation.site.name}
        </Link>{" "}
        / {workstation.name}
      </p>
      <h1 className="text-xl font-semibold">{dict.heading}</h1>

      <form action={createSession} className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-sm">
            {dict.startedAtLabel}
            <input
              type="datetime-local"
              name="startedAt"
              required
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.endedAtLabel}
            <input
              type="datetime-local"
              name="endedAt"
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.modeLabel}
            <select
              name="mode"
              defaultValue={AssessmentMode.SCHEDULED}
              className="rounded border px-2 py-1"
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          {dict.pilotContextLabel}
          <input
            type="text"
            name="pilotContext"
            placeholder={dict.pilotContextPlaceholder}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {dict.notesLabel}
          <input
            type="text"
            name="notes"
            className="rounded border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black"
        >
          {dict.create}
        </button>
      </form>

      {sessions.length === 0 && <p className="text-sm">{dict.empty}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">{dict.colStarted}</th>
            <th className="py-1 pr-4">{dict.colEnded}</th>
            <th className="py-1 pr-4">{dict.colMode}</th>
            <th className="py-1 pr-4">{dict.colPilotContext}</th>
            <th className="py-1">{dict.colNotes}</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id} className="border-b last:border-0">
              <td className="py-1 pr-4">{session.startedAt.toISOString()}</td>
              <td className="py-1 pr-4">
                {session.endedAt ? session.endedAt.toISOString() : dict.none}
              </td>
              <td className="py-1 pr-4">{session.mode}</td>
              <td className="py-1 pr-4">{session.pilotContext ?? dict.none}</td>
              <td className="py-1">{session.notes ?? dict.none}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
