import type { CmrCategory } from "@/generated/prisma/enums";

// P8 §2 CMR helpers (SLD_P8_GEFAHRSTOFFE_APPROVED.md). Pure. The retention and
// exposure logic reads these, never a single boolean.

type CmrCategories = {
  carcinogenicCategory: CmrCategory;
  mutagenicCategory: CmrCategory;
  reprotoxicCategory: CmrCategory;
};

// DE § 10a exposure-register scope: carcinogenic/mutagenic/reprotoxic 1A or 1B.
export function isCmr1A1B(c: CmrCategories): boolean {
  return [
    c.carcinogenicCategory,
    c.mutagenicCategory,
    c.reprotoxicCategory,
  ].some((x) => x === "CAT_1A" || x === "CAT_1B");
}

// AT § 47 scope: any CMR category at all (not restricted to 1A/1B).
export function isCmrAny(c: CmrCategories): boolean {
  return [
    c.carcinogenicCategory,
    c.mutagenicCategory,
    c.reprotoxicCategory,
  ].some((x) => x !== "NONE");
}
