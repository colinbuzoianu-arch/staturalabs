import { CategoryCheckStatus, HazardCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here — the pure cores below need to
// be directly unit-testable, same reasoning as risk-assessment.ts /
// psychosocial-finding.ts.

// The full set of hazard categories an Evaluierung must cover (ASchG §4/§5).
// Sourced from the enum itself so a future HazardCategory value is covered
// automatically — there is no second hand-maintained list to drift from it.
export const ALL_HAZARD_CATEGORIES: HazardCategory[] =
  Object.values(HazardCategory);

export type HazardCategoryCheckLike = {
  category: HazardCategory;
  status: CategoryCheckStatus;
};

export type SubmitForReviewResult =
  | { ok: true }
  | {
      ok: false;
      // Categories a human has not assessed yet (status OPEN, or no check
      // row at all). This is the headline block the gate reports.
      openCategories: HazardCategory[];
      // Categories whose recorded status contradicts the findings that
      // actually exist — a defensive guarantee of the HAZARD_PRESENT <->
      // finding invariant (§3.1), not an expected path (the status-flip at
      // finding creation keeps these in sync).
      inconsistentCategories: HazardCategory[];
    };

// Pure completeness core (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md
// §3.1/§3.5). An Evaluierung may move DRAFT -> IN_REVIEW only once every one
// of the 13 HazardCategories carries an explicit, human-set status. A
// category left OPEN (or with no check row at all) blocks review, and the
// block names exactly which categories — this is the completeness proof the
// plan calls "the feature to sell".
//
// `findingCategories` are the hazard categories of the assessment's
// findings. They enforce the HAZARD_PRESENT <-> finding-exists invariant:
// a category marked HAZARD_PRESENT with no finding, or marked
// NOT_APPLICABLE/CHECKED_NO_HAZARD while a finding of it exists, is a
// contradiction that also blocks review. Normal data never reaches these —
// markCategoryHazardPresent flips the status when a finding is added — they
// are a fail-closed guard, never an expected state.
export function canSubmitForReview(
  checks: HazardCategoryCheckLike[],
  findingCategories: HazardCategory[],
): SubmitForReviewResult {
  const statusByCategory = new Map(
    checks.map((check) => [check.category, check.status]),
  );
  const categoriesWithFinding = new Set(findingCategories);

  const openCategories: HazardCategory[] = [];
  const inconsistentCategories: HazardCategory[] = [];

  for (const category of ALL_HAZARD_CATEGORIES) {
    const status = statusByCategory.get(category);

    if (status === undefined || status === CategoryCheckStatus.OPEN) {
      openCategories.push(category);
      continue;
    }

    const hasFinding = categoriesWithFinding.has(category);
    if (status === CategoryCheckStatus.HAZARD_PRESENT && !hasFinding) {
      inconsistentCategories.push(category);
    } else if (
      (status === CategoryCheckStatus.NOT_APPLICABLE ||
        status === CategoryCheckStatus.CHECKED_NO_HAZARD) &&
      hasFinding
    ) {
      inconsistentCategories.push(category);
    }
  }

  if (openCategories.length === 0 && inconsistentCategories.length === 0) {
    return { ok: true };
  }
  return { ok: false, openCategories, inconsistentCategories };
}

// Pure status-flip rule (§3.1: "Adding the first finding flips the status
// automatically"). A RiskFinding of a category is, by definition, a hazard
// of that category being present — so its check becomes HAZARD_PRESENT
// regardless of its prior status, including a previously-recorded
// CHECKED_NO_HAZARD/NOT_APPLICABLE that the finding now contradicts. The
// current status is taken only to make the rule explicit and testable; the
// result is unconditional.
export function statusAfterFindingAdded(
  _current: CategoryCheckStatus | undefined,
): CategoryCheckStatus {
  return CategoryCheckStatus.HAZARD_PRESENT;
}

// Pure: the rows to seed when a RiskAssessment is created — one OPEN row per
// HazardCategory, created explicitly in the same transaction as the
// assessment, never inferred at read time (§3.1, §3.17). Exported so
// createRiskAssessment and the tests share one definition of "a fresh
// assessment's completeness rows".
export function initialCategoryCheckRows(riskAssessmentId: string): {
  riskAssessmentId: string;
  category: HazardCategory;
  status: CategoryCheckStatus;
}[] {
  return ALL_HAZARD_CATEGORIES.map((category) => ({
    riskAssessmentId,
    category,
    status: CategoryCheckStatus.OPEN,
  }));
}

// Pure mirror of the backfill CASE in
// 20261016120100_add_hazard_category_check: a pre-existing assessment's
// category is HAZARD_PRESENT when a finding of it already exists, OPEN
// otherwise — NEVER CHECKED_NO_HAZARD (§8: "we didn't check, so we don't
// claim we did"). Kept here, tested here, so the mapping the migration SQL
// encodes has a checkable definition in code too.
export function backfillStatusForCategory(
  hasFinding: boolean,
): CategoryCheckStatus {
  return hasFinding
    ? CategoryCheckStatus.HAZARD_PRESENT
    : CategoryCheckStatus.OPEN;
}

// Accepts the top-level `prisma` client or a `$transaction` tx — a minimal
// structural type so a caller can keep the flip atomic with finding
// creation (pass the tx) or run it standalone (pass prisma), without
// importing Prisma's TransactionClient type.
type HazardCategoryCheckUpdater = {
  hazardCategoryCheck: {
    updateMany: (args: {
      where: { riskAssessmentId: string; category: HazardCategory };
      data: { status: CategoryCheckStatus };
    }) => Promise<unknown>;
  };
};

// Flip a category's check to HAZARD_PRESENT, maintaining the
// HAZARD_PRESENT <-> finding-exists invariant when a finding is added.
// updateMany (not update): it never throws on a missing row, so it's a safe
// no-op if a check row somehow doesn't exist — the row always does for an
// assessment created or backfilled under this milestone, but the gate's
// fail-closed guarantee shouldn't depend on it. The automatic flip records
// no checkedByUserId/checkedAt: it's a system-maintained consequence of a
// finding existing, not a human's category-status judgement (which the
// checklist UI records explicitly).
export async function markCategoryHazardPresent(
  client: HazardCategoryCheckUpdater,
  riskAssessmentId: string,
  category: HazardCategory,
): Promise<void> {
  await client.hazardCategoryCheck.updateMany({
    where: { riskAssessmentId, category },
    data: { status: CategoryCheckStatus.HAZARD_PRESENT },
  });
}

// Thrown by assertCanSubmitForReview so a caller (a Server Action) can
// localize the message from the category lists rather than parse a string.
export class CategoryCompletenessError extends Error {
  constructor(
    readonly openCategories: HazardCategory[],
    readonly inconsistentCategories: HazardCategory[],
  ) {
    const parts = [
      `${openCategories.length} category(ies) not yet assessed: ${openCategories.join(", ")}`,
    ];
    if (inconsistentCategories.length > 0) {
      parts.push(
        `inconsistent with recorded findings: ${inconsistentCategories.join(", ")}`,
      );
    }
    super(`Cannot submit for review — ${parts.join("; ")}`);
    this.name = "CategoryCompletenessError";
  }
}

// The DRAFT -> IN_REVIEW completeness gate: loads the assessment's category
// checks and its findings' categories, runs the pure core, and throws a
// CategoryCompletenessError naming what's missing if it isn't satisfied.
// The single place the submit-for-review transition consults completeness,
// so both the admin detail page and (later) the workstation hub share one
// definition of "complete".
export async function assertCanSubmitForReview(
  riskAssessmentId: string,
): Promise<void> {
  const [checks, findings] = await Promise.all([
    prisma.hazardCategoryCheck.findMany({
      where: { riskAssessmentId },
      select: { category: true, status: true },
    }),
    prisma.riskFinding.findMany({
      where: { riskAssessmentId },
      select: { hazard: { select: { category: true } } },
    }),
  ]);

  const result = canSubmitForReview(
    checks,
    findings.map((finding) => finding.hazard.category),
  );

  if (!result.ok) {
    throw new CategoryCompletenessError(
      result.openCategories,
      result.inconsistentCategories,
    );
  }
}
