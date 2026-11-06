import "server-only";

import { createAssessmentSession } from "@/lib/assessment-session";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P13 §3 onboarding: step progress is DERIVED from the tenant's own data
// (resumable, no separate wizard state), plus a completion marker on Company so
// it can be skipped/finished. The sample dataset is clearly name-marked and
// carries a pilotContext on its session, so it can never be mistaken for real
// data (it also shows under /admin/pilot-data), and is removable in one click.

export const SAMPLE_MARKER = "[BEISPIEL]";
export const SAMPLE_PILOT_CONTEXT = "ONBOARDING-SAMPLE — not real data";

export type OnboardingStatus = {
  completed: boolean;
  hasSecondSite: boolean;
  hasOrgUnits: boolean;
  hasWorkstations: boolean;
  hasPersons: boolean;
  hasAssessment: boolean;
  hasSample: boolean;
};

export async function getOnboardingStatus(
  companyId: string,
): Promise<OnboardingStatus> {
  const [company, sites, orgUnits, workstations, persons, assessments, sample] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { onboardingCompletedAt: true },
      }),
      prisma.site.count({ where: { companyId } }),
      prisma.orgUnit.count({ where: { site: { companyId } } }),
      prisma.workstation.count({ where: { site: { companyId } } }),
      prisma.person.count({ where: { companyId } }),
      prisma.riskAssessment.count({ where: { site: { companyId } } }),
      prisma.workstation.count({
        where: { site: { companyId }, name: { contains: SAMPLE_MARKER } },
      }),
    ]);
  return {
    completed: company?.onboardingCompletedAt != null,
    hasSecondSite: sites > 1,
    hasOrgUnits: orgUnits > 0,
    hasWorkstations: workstations > 0,
    hasPersons: persons > 0,
    hasAssessment: assessments > 0,
    hasSample: sample > 0,
  };
}

export async function completeOnboarding(
  companyId: string,
  actorUserId: string,
): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: { onboardingCompletedAt: new Date() },
  });
  await recordAuditEvent({
    actorUserId,
    action: "onboarding.complete",
    entityType: "Company",
    entityId: companyId,
    companyId,
  });
}

// Load a small, clearly-marked sample for the tenant's first site: one org unit,
// one workstation, one task, and a pilotContext-marked assessment session.
export async function loadSampleData(input: {
  companyId: string;
  siteId: string;
  actorUserId: string;
}): Promise<void> {
  const existing = await prisma.workstation.findFirst({
    where: { siteId: input.siteId, name: { contains: SAMPLE_MARKER } },
    select: { id: true },
  });
  if (existing) return; // idempotent — already loaded

  const orgUnit = await prisma.orgUnit.create({
    data: {
      siteId: input.siteId,
      name: `${SAMPLE_MARKER} Beispielwerk`,
      type: "PLANT",
    },
  });
  const workstation = await prisma.workstation.create({
    data: {
      siteId: input.siteId,
      orgUnitId: orgUnit.id,
      name: `${SAMPLE_MARKER} Beispiel-Arbeitsplatz`,
    },
  });
  await prisma.task.create({
    data: {
      workstationId: workstation.id,
      name: `${SAMPLE_MARKER} Beispieltätigkeit`,
    },
  });
  await createAssessmentSession({
    workstationId: workstation.id,
    startedAt: new Date(),
    pilotContext: SAMPLE_PILOT_CONTEXT,
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "onboarding.load_sample",
    entityType: "Company",
    entityId: input.companyId,
    companyId: input.companyId,
    siteId: input.siteId,
  });
}

// Remove the sample in one click: leaf-to-root by the name marker (sessions +
// their join rows, tasks, workstations, org units).
export async function removeSampleData(input: {
  companyId: string;
  actorUserId: string;
}): Promise<void> {
  const workstations = await prisma.workstation.findMany({
    where: {
      site: { companyId: input.companyId },
      name: { contains: SAMPLE_MARKER },
    },
    select: { id: true },
  });
  const wsIds = workstations.map((w) => w.id);
  await prisma.$transaction(async (tx) => {
    const sessions = await tx.assessmentSession.findMany({
      where: { workstationId: { in: wsIds } },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    await tx.assessmentSessionTask.deleteMany({
      where: { assessmentSessionId: { in: sessionIds } },
    });
    await tx.assessmentSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
    await tx.task.deleteMany({ where: { workstationId: { in: wsIds } } });
    await tx.workstation.deleteMany({ where: { id: { in: wsIds } } });
    await tx.orgUnit.deleteMany({
      where: {
        site: { companyId: input.companyId },
        name: { contains: SAMPLE_MARKER },
      },
    });
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "onboarding.remove_sample",
    entityType: "Company",
    entityId: input.companyId,
    companyId: input.companyId,
  });
}
