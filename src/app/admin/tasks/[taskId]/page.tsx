import Link from "next/link";
import { notFound } from "next/navigation";
import { validatePostureSample } from "@/app/(app)/tasks/[taskId]/actions";
import {
  PostureSampleAccordion,
  type PostureSampleAccordionItem,
} from "@/components/posture-sample-accordion";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { buildRegionResults } from "@/lib/capture/build-region-results";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import type { PoseLandmarks } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { worstRiskBand } from "@/lib/risk/band-severity";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

// Reviewed/adjusted through PostureEditor (an accordion of one per sample —
// see posture-sample-accordion.tsx), same as the (app) dashboard's own task
// page — the editor's region panel already shows the full per-region
// breakdown buildRegionResults produces, so a separate static table next to
// it would just be the same data twice.
export default async function TaskResultsPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const adminUser = await requireSuperAdmin();
  const { taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      workstation: { include: { site: { include: { company: true } } } },
    },
  });
  if (!task) notFound();

  const samples = await prisma.postureSample.findMany({
    where: { taskId },
    orderBy: { capturedAt: "desc" },
  });

  // validatedByUserId is a plain UUID column, not a DB-level FK (see
  // PostureSample's own schema comment) — resolved here via one batched
  // lookup rather than per-sample.
  const validatorIds = [
    ...new Set(
      samples.flatMap((s) =>
        s.validatedByUserId ? [s.validatedByUserId] : [],
      ),
    ),
  ];
  const validators =
    validatorIds.length > 0
      ? await prisma.platformUser.findMany({
          where: { id: { in: validatorIds } },
          select: { id: true, name: true },
        })
      : [];
  const validatorNameById = new Map(validators.map((v) => [v.id, v.name]));

  const locale = await getLocale();
  const dict = getAdminDictionary(locale).taskResultsPage;

  let methodologyVersion: string | null = null;
  let methodologyError: string | null = null;
  try {
    methodologyVersion = await getActiveMethodologyVersion();
  } catch (err) {
    methodologyError =
      err instanceof Error ? err.message : "No active methodology version";
  }

  const items: PostureSampleAccordionItem[] = methodologyVersion
    ? await Promise.all(
        samples.map(async (sample): Promise<PostureSampleAccordionItem> => {
          const base = {
            id: sample.id,
            capturedAt: sample.capturedAt,
            cameraAngle: sample.cameraAngle,
            keypoints: sample.keypoints,
            validatedKeypoints: sample.validatedKeypoints,
            validationStatus: sample.validationStatus,
            validatedAt: sample.validatedAt,
            validatedByName: sample.validatedByUserId
              ? (validatorNameById.get(sample.validatedByUserId) ?? null)
              : null,
          };
          try {
            const { regions } = await buildRegionResults({
              keypoints: sample.keypoints as unknown as PoseLandmarks,
              validatedKeypoints:
                sample.validatedKeypoints as unknown as PoseLandmarks | null,
              validationStatus: sample.validationStatus,
              cameraAngle: sample.cameraAngle,
              methodologyVersion,
            });
            const worstBand = worstRiskBand(
              Object.values(regions).flatMap((r) =>
                r.status === "scored" ? [r.riskBand] : [],
              ),
            );
            return { ...base, regionResults: regions, error: null, worstBand };
          } catch (err) {
            return {
              ...base,
              regionResults: null,
              error:
                err instanceof Error
                  ? err.message
                  : "Could not compute body angles",
              worstBand: null,
            };
          }
        }),
      )
    : samples.map((sample) => ({
        id: sample.id,
        capturedAt: sample.capturedAt,
        cameraAngle: sample.cameraAngle,
        keypoints: sample.keypoints,
        validatedKeypoints: sample.validatedKeypoints,
        validationStatus: sample.validationStatus,
        validatedAt: sample.validatedAt,
        validatedByName: sample.validatedByUserId
          ? (validatorNameById.get(sample.validatedByUserId) ?? null)
          : null,
        regionResults: null,
        error: null,
        worstBand: null,
      }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link href="/admin/companies" className="underline">
          {dict.companiesBreadcrumb}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/companies/${task.workstation.site.companyId}/sites`}
          className="underline"
        >
          {task.workstation.site.company.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/sites/${task.workstation.siteId}/workstations`}
          className="underline"
        >
          {task.workstation.site.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/workstations/${task.workstationId}/tasks`}
          className="underline"
        >
          {task.workstation.name}
        </Link>{" "}
        / {task.name}
      </p>
      <h1 className="text-xl font-semibold">{dict.heading(task.name)}</h1>
      <p className="flex gap-3">
        <Link href={`/tasks/${task.id}/capture`} className="underline">
          {dict.captureNewSample}
        </Link>
        {/* Plain <a>, not next/link: file download (Content-Disposition:
            attachment), not a client-side page transition — same reasoning
            as the (app) dashboard's task page. */}
        <a href={`/api/tasks/${task.id}/report`} className="underline">
          {dict.downloadReport}
        </a>
      </p>

      {methodologyError && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
          {dict.cannotRecompute(methodologyError)}
        </div>
      )}

      {methodologyVersion && (
        <p className="text-xs text-zinc-500">
          {dict.recomputeNote(methodologyVersion)}
        </p>
      )}

      {samples.length === 0 && <p className="text-sm">{dict.empty}</p>}

      {items.length > 0 && (
        <PostureSampleAccordion
          items={items}
          currentUserName={adminUser.name}
          onValidate={validatePostureSample}
        />
      )}
    </div>
  );
}
