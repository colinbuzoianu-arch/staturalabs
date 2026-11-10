import { describe, expect, it } from "vitest";
import { de as adminDe } from "./dictionaries/admin/de";
import { en as adminEn } from "./dictionaries/admin/en";
import { ro as adminRo } from "./dictionaries/admin/ro";
import { de as administrationDe } from "./dictionaries/administration/de";
import { en as administrationEn } from "./dictionaries/administration/en";
import { ro as administrationRo } from "./dictionaries/administration/ro";
import { de as commonDe } from "./dictionaries/common/de";
import { en as commonEn } from "./dictionaries/common/en";
import { ro as commonRo } from "./dictionaries/common/ro";
import { de as dashboardDe } from "./dictionaries/dashboard/de";
import { en as dashboardEn } from "./dictionaries/dashboard/en";
import { ro as dashboardRo } from "./dictionaries/dashboard/ro";
import { de as loginDe } from "./dictionaries/login/de";
import { en as loginEn } from "./dictionaries/login/en";
import { ro as loginRo } from "./dictionaries/login/ro";
import { de as marketingDe } from "./dictionaries/marketing/de";
import { en as marketingEn } from "./dictionaries/marketing/en";
import { ro as marketingRo } from "./dictionaries/marketing/ro";
import { de as securityDe } from "./dictionaries/security/de";
import { en as securityEn } from "./dictionaries/security/en";
import { ro as securityRo } from "./dictionaries/security/ro";

// P13 §4 i18n completeness: every user-facing string resolves in all three
// locales (EN/DE/RO) — no missing or extra keys in any area. The `typeof en`
// typing already enforces this at compile time; this test is the runtime
// backstop and documents the full set of areas in one place, so a newly added
// area that someone forgets to translate fails CI loudly rather than rendering
// `undefined`.

// Deep key paths of an object, e.g. "companiesPage.heading". Leaves are strings;
// arrays (ordered label lists) are compared by length + per-index recursion.
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (Array.isArray(obj)) {
    return obj.flatMap((v, i) => keyPaths(v, `${prefix}[${i}]`));
  }
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

const areas: Record<string, { en: unknown; de: unknown; ro: unknown }> = {
  admin: { en: adminEn, de: adminDe, ro: adminRo },
  administration: {
    en: administrationEn,
    de: administrationDe,
    ro: administrationRo,
  },
  common: { en: commonEn, de: commonDe, ro: commonRo },
  dashboard: { en: dashboardEn, de: dashboardDe, ro: dashboardRo },
  login: { en: loginEn, de: loginDe, ro: loginRo },
  marketing: { en: marketingEn, de: marketingDe, ro: marketingRo },
  security: { en: securityEn, de: securityDe, ro: securityRo },
};

describe("i18n completeness", () => {
  for (const [name, { en, de, ro }] of Object.entries(areas)) {
    it(`${name}: DE and RO cover exactly the EN key set`, () => {
      const enKeys = keyPaths(en).sort();
      expect(keyPaths(de).sort(), `${name} DE`).toEqual(enKeys);
      expect(keyPaths(ro).sort(), `${name} RO`).toEqual(enKeys);
    });

    it(`${name}: no empty strings in any locale`, () => {
      for (const [loc, dict] of [
        ["en", en],
        ["de", de],
        ["ro", ro],
      ] as const) {
        const leaves = collectStringLeaves(dict);
        const empties = leaves.filter((s) => s.trim() === "");
        expect(empties, `${name} ${loc} empty strings`).toEqual([]);
      }
    });
  }
});

function collectStringLeaves(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (Array.isArray(obj)) return obj.flatMap(collectStringLeaves);
  if (obj && typeof obj === "object")
    return Object.values(obj).flatMap(collectStringLeaves);
  return [];
}
