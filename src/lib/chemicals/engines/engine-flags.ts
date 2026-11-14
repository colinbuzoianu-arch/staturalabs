import "server-only";

import type { EngineFlagState } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { appEnvironment, effectiveEngineState } from "@/lib/config/environment";
import { prisma } from "@/lib/prisma";
import { ENGINE_VERSION } from "./prepared";

// P16 §2: resolve + set the three-state engine flags, with the VALIDATED guard.

export async function hasCurrentEngineReview(
  engineKey: string,
): Promise<boolean> {
  const version = ENGINE_VERSION[engineKey];
  if (!version) return false;
  const review = await prisma.engineReview.findUnique({
    where: { engineKey_engineVersion: { engineKey, engineVersion: version } },
    select: { id: true },
  });
  return review !== null;
}

// The EFFECTIVE state for a tenant: the explicit setting (or the env default),
// with VALIDATED failing safe to PREVIEW when no current review exists.
export async function resolveEngineFlagState(
  engineKey: string,
  companyId: string,
): Promise<EngineFlagState> {
  const setting = await prisma.engineFlagSetting.findUnique({
    where: { engineKey_companyId: { engineKey, companyId } },
    select: { state: true },
  });
  const hasReview =
    setting?.state === "VALIDATED"
      ? await hasCurrentEngineReview(engineKey)
      : false;
  return effectiveEngineState(
    setting?.state ?? null,
    hasReview,
    appEnvironment(),
  ) as EngineFlagState;
}

// At least PREVIEW — the gate for whether a tenant sees any engine output.
export async function isEnginePreviewable(
  engineKey: string,
  companyId: string,
): Promise<boolean> {
  const s = await resolveEngineFlagState(engineKey, companyId);
  return s === "PREVIEW" || s === "VALIDATED";
}

// Any engine at PREVIEW+ — gates the "Prüfung & Berechnung" tab's visibility.
export async function anyEnginePreviewable(
  companyId: string,
): Promise<boolean> {
  const states = await Promise.all(
    Object.keys(ENGINE_VERSION).map((k) =>
      resolveEngineFlagState(k, companyId),
    ),
  );
  return states.some((s) => s === "PREVIEW" || s === "VALIDATED");
}

// super_admin-gated at the call site. VALIDATED requires a current EngineReview.
export async function setEngineFlagState(input: {
  engineKey: string;
  companyId: string;
  state: EngineFlagState;
  actorUserId: string;
}): Promise<void> {
  if (!ENGINE_VERSION[input.engineKey])
    throw new Error(`Unknown engine key ${input.engineKey}`);
  if (
    input.state === "VALIDATED" &&
    !(await hasCurrentEngineReview(input.engineKey))
  ) {
    throw new Error(
      `Cannot set VALIDATED for ${input.engineKey}: no EngineReview exists for version ${ENGINE_VERSION[input.engineKey]}`,
    );
  }
  await prisma.engineFlagSetting.upsert({
    where: {
      engineKey_companyId: {
        engineKey: input.engineKey,
        companyId: input.companyId,
      },
    },
    create: {
      engineKey: input.engineKey,
      companyId: input.companyId,
      state: input.state,
      setByUserId: input.actorUserId,
    },
    update: { state: input.state, setByUserId: input.actorUserId },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "engine_flag.set",
    entityType: "EngineFlagSetting",
    entityId: `${input.engineKey}:${input.companyId}`,
    companyId: input.companyId,
    diff: { engineKey: input.engineKey, state: input.state },
  });
}

export async function createEngineReview(input: {
  engineKey: string;
  reviewerName: string;
  reviewerQualification: string;
  scope: string;
  notes?: string | null;
  actorUserId: string;
}): Promise<void> {
  const engineVersion = ENGINE_VERSION[input.engineKey];
  if (!engineVersion) throw new Error(`Unknown engine key ${input.engineKey}`);
  await prisma.engineReview.upsert({
    where: {
      engineKey_engineVersion: { engineKey: input.engineKey, engineVersion },
    },
    create: {
      engineKey: input.engineKey,
      engineVersion,
      reviewerName: input.reviewerName.trim(),
      reviewerQualification: input.reviewerQualification.trim(),
      reviewedAt: new Date(),
      scope: input.scope.trim(),
      notes: input.notes?.trim() || null,
      createdByUserId: input.actorUserId,
    },
    update: {},
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "engine_review.create",
    entityType: "EngineReview",
    entityId: `${input.engineKey}:${engineVersion}`,
    diff: { reviewer: input.reviewerName, scope: input.scope },
  });
}
