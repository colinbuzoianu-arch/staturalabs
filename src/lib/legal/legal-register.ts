import "server-only";

import type {
  ComplianceState,
  HazardCategory,
  SiteLegalRequirementStatus,
} from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { isModuleEnabled } from "@/lib/modules/entitlement";
import { addDuration, parseIsoDuration } from "@/lib/people/retention";
import { prisma } from "@/lib/prisma";
import type { SiteFacts } from "./applicability";

// P11 §6.1/§6.4 write gates for the Rechtskataster — the active-catalogue
// getter (fail-closed), site-fact gathering for applicability suggestions, and
// the human-confirmed status / compliance-evaluation / action gates. Every
// mutation audited. Person-free: facts are counts and module entitlement, never
// a Person.

export async function getActiveLegalRequirementCatalog(): Promise<string> {
  const active = await prisma.legalRequirementCatalogVersion.findFirst({
    where: { isActive: true },
    select: { version: true },
  });
  if (!active) {
    throw new Error(
      "No active LegalRequirementCatalogVersion — cannot resolve requirements without one",
    );
  }
  return active.version;
}

// Gather the site's facts for applicability suggestions. All derived from
// site/module data; the only "count" is Site.employeeCount (a figure).
export async function getSiteFacts(
  siteId: string,
  companyId: string,
): Promise<SiteFacts> {
  const [
    site,
    oshActive,
    environmentActive,
    findingCats,
    substanceUses,
    wasteStreams,
  ] = await Promise.all([
    prisma.site.findUnique({
      where: { id: siteId },
      select: { employeeCount: true },
    }),
    isModuleEnabled(companyId, "RISK"),
    isModuleEnabled(companyId, "ENVIRONMENT"),
    prisma.riskFinding.findMany({
      where: { riskAssessment: { siteId } },
      select: { hazard: { select: { category: true } } },
    }),
    prisma.substanceUse.count({ where: { siteId } }),
    prisma.wasteStream.count({ where: { siteId } }),
  ]);
  const hazardCategories = Array.from(
    new Set(findingCats.map((f) => f.hazard.category as HazardCategory)),
  );
  return {
    oshActive,
    environmentActive,
    hazardCategories,
    usesSubstances: substanceUses > 0,
    hasWasteStreams: wasteStreams > 0,
    employeeCount: site?.employeeCount ?? null,
  };
}

// Confirm (or set) a site's applicability for a requirement — human action,
// never inferred. rationale required for NOT_APPLICABLE (mirrors the DB CHECK).
export async function setSiteRequirementStatus(input: {
  siteId: string;
  legalRequirementId: string;
  companyId: string;
  status: SiteLegalRequirementStatus;
  rationale?: string | null;
  actorUserId: string | null;
}): Promise<{ id: string }> {
  if (input.status === "NOT_APPLICABLE" && !input.rationale?.trim()) {
    throw new Error(
      "A rationale is required to mark a requirement not applicable",
    );
  }
  const rationale =
    input.status === "NOT_APPLICABLE"
      ? (input.rationale as string).trim()
      : null;
  const row = await prisma.siteLegalRequirement.upsert({
    where: {
      siteId_legalRequirementId: {
        siteId: input.siteId,
        legalRequirementId: input.legalRequirementId,
      },
    },
    create: {
      siteId: input.siteId,
      legalRequirementId: input.legalRequirementId,
      status: input.status,
      rationale,
      assignedByUserId: input.actorUserId,
      assignedAt: new Date(),
      // A freshly-confirmed row clears any pending review flag.
      reviewRequired: false,
    },
    update: {
      status: input.status,
      rationale,
      assignedByUserId: input.actorUserId,
      assignedAt: new Date(),
      reviewRequired: false,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "legal_requirement.set_status",
    entityType: "SiteLegalRequirement",
    entityId: row.id,
    companyId: input.companyId,
    siteId: input.siteId,
    diff: { status: input.status },
  });
  return { id: row.id };
}

// Record a compliance evaluation: upsert the 1:1 evaluation, append an event,
// compute nextReviewDue from the requirement's defaultReviewInterval. Audited.
export async function evaluateCompliance(input: {
  siteLegalRequirementId: string;
  companyId: string;
  siteId: string;
  state: ComplianceState;
  note?: string | null;
  evidence?: unknown;
  actorUserId: string;
  now?: Date;
}): Promise<void> {
  const link = await prisma.siteLegalRequirement.findUnique({
    where: { id: input.siteLegalRequirementId },
    select: {
      siteId: true,
      evaluation: { select: { state: true } },
      legalRequirement: { select: { defaultReviewInterval: true } },
    },
  });
  if (!link || link.siteId !== input.siteId) {
    throw new Error("Requirement not found");
  }
  const now = input.now ?? new Date();
  const dur = parseIsoDuration(link.legalRequirement.defaultReviewInterval);
  const nextReviewDue = dur ? addDuration(now, dur) : null;
  const fromState = link.evaluation?.state ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.complianceEvaluation.upsert({
      where: { siteLegalRequirementId: input.siteLegalRequirementId },
      create: {
        siteLegalRequirementId: input.siteLegalRequirementId,
        state: input.state,
        evaluatedByUserId: input.actorUserId,
        evaluatedAt: now,
        note: input.note?.trim() || null,
        evidence:
          input.evidence === undefined ? undefined : (input.evidence as never),
        nextReviewDue,
      },
      update: {
        state: input.state,
        evaluatedByUserId: input.actorUserId,
        evaluatedAt: now,
        note: input.note?.trim() || null,
        evidence:
          input.evidence === undefined ? undefined : (input.evidence as never),
        nextReviewDue,
      },
    });
    await tx.complianceEvaluationEvent.create({
      data: {
        siteLegalRequirementId: input.siteLegalRequirementId,
        fromState,
        toState: input.state,
        byUserId: input.actorUserId,
        note: input.note?.trim() || null,
      },
    });
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "compliance_evaluation.set",
    entityType: "SiteLegalRequirement",
    entityId: input.siteLegalRequirementId,
    companyId: input.companyId,
    siteId: input.siteId,
    diff: { from: fromState, to: input.state },
  });
}

// Raise an Action from a (partially/non-)compliant evaluation — the one action
// engine (§2.2): complianceEvaluationId is the Action's single source.
export async function raiseActionFromCompliance(input: {
  complianceEvaluationId: string;
  siteId: string;
  companyId: string;
  actorUserId: string | null;
  title: string;
  responsibleRoleLabel?: string | null;
}): Promise<{ id: string }> {
  const evalRow = await prisma.complianceEvaluation.findUnique({
    where: { id: input.complianceEvaluationId },
    select: {
      siteLegalRequirement: { select: { siteId: true } },
    },
  });
  if (!evalRow || evalRow.siteLegalRequirement.siteId !== input.siteId) {
    throw new Error("Evaluation not found");
  }
  if (input.title.trim().length === 0) {
    throw new Error("Action title is required");
  }
  const action = await prisma.action.create({
    data: {
      siteId: input.siteId,
      complianceEvaluationId: input.complianceEvaluationId,
      title: input.title.trim(),
      responsibleRoleLabel: input.responsibleRoleLabel?.trim() || null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "action.create",
    entityType: "Action",
    entityId: action.id,
    companyId: input.companyId,
    siteId: input.siteId,
    diff: {
      source: "compliance",
      complianceEvaluationId: input.complianceEvaluationId,
    },
  });
  return { id: action.id };
}
