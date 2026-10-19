import {
  CategoryCheckStatus,
  EnvironmentalAspectCategory,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Environmental completeness gate — a direct copy of
// src/lib/risk/category-check.ts (SLD_IMPLEMENTATION_PLAN_hazards-and-
// environment.md §5.2: "Build H1 so that this is a copy, not a rewrite"),
// keyed on EnvironmentalAspectCategory and EnvironmentalCategoryCheck. Same
// CategoryCheckStatus enum, same "OPEN until a human sets it, never
// inferred" discipline (§8). No `import "server-only"` — the pure cores are
// unit-tested directly.

export const ALL_ENVIRONMENTAL_CATEGORIES: EnvironmentalAspectCategory[] =
  Object.values(EnvironmentalAspectCategory);

export type EnvironmentalCategoryCheckLike = {
  category: EnvironmentalAspectCategory;
  status: CategoryCheckStatus;
};

export type SubmitForReviewResult =
  | { ok: true }
  | {
      ok: false;
      openCategories: EnvironmentalAspectCategory[];
      inconsistentCategories: EnvironmentalAspectCategory[];
    };

export function canSubmitForReview(
  checks: EnvironmentalCategoryCheckLike[],
  findingCategories: EnvironmentalAspectCategory[],
): SubmitForReviewResult {
  const statusByCategory = new Map(
    checks.map((check) => [check.category, check.status]),
  );
  const categoriesWithFinding = new Set(findingCategories);

  const openCategories: EnvironmentalAspectCategory[] = [];
  const inconsistentCategories: EnvironmentalAspectCategory[] = [];

  for (const category of ALL_ENVIRONMENTAL_CATEGORIES) {
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

// A finding of a category means that aspect category is present — flip to
// HAZARD_PRESENT (the shared CategoryCheckStatus value; here it reads as
// "aspect present"). Unconditional, same rule as the OSH side.
export function statusAfterFindingAdded(
  _current: CategoryCheckStatus | undefined,
): CategoryCheckStatus {
  return CategoryCheckStatus.HAZARD_PRESENT;
}

export function initialCategoryCheckRows(environmentalAssessmentId: string): {
  environmentalAssessmentId: string;
  category: EnvironmentalAspectCategory;
  status: CategoryCheckStatus;
}[] {
  return ALL_ENVIRONMENTAL_CATEGORIES.map((category) => ({
    environmentalAssessmentId,
    category,
    status: CategoryCheckStatus.OPEN,
  }));
}

type EnvironmentalCategoryCheckUpdater = {
  environmentalCategoryCheck: {
    updateMany: (args: {
      where: {
        environmentalAssessmentId: string;
        category: EnvironmentalAspectCategory;
      };
      data: { status: CategoryCheckStatus };
    }) => Promise<unknown>;
  };
};

export async function markCategoryAspectPresent(
  client: EnvironmentalCategoryCheckUpdater,
  environmentalAssessmentId: string,
  category: EnvironmentalAspectCategory,
): Promise<void> {
  await client.environmentalCategoryCheck.updateMany({
    where: { environmentalAssessmentId, category },
    data: { status: CategoryCheckStatus.HAZARD_PRESENT },
  });
}

export class CategoryCompletenessError extends Error {
  constructor(
    readonly openCategories: EnvironmentalAspectCategory[],
    readonly inconsistentCategories: EnvironmentalAspectCategory[],
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

export async function assertCanSubmitForReview(
  environmentalAssessmentId: string,
): Promise<void> {
  const [checks, findings] = await Promise.all([
    prisma.environmentalCategoryCheck.findMany({
      where: { environmentalAssessmentId },
      select: { category: true, status: true },
    }),
    prisma.environmentalFinding.findMany({
      where: { environmentalAssessmentId },
      select: { aspect: { select: { category: true } } },
    }),
  ]);

  const result = canSubmitForReview(
    checks,
    findings.map((finding) => finding.aspect.category),
  );

  if (!result.ok) {
    throw new CategoryCompletenessError(
      result.openCategories,
      result.inconsistentCategories,
    );
  }
}
