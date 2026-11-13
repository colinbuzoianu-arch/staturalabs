// P15 S5b: TRGS 510 Zusammenlagerung — pure check. Given the Lagerklassen present
// at one storage location and the compatibility matrix, flag the pairs that are
// NOT_ALLOWED or allowed only CONDITIONALLY, with the table reference. Pure,
// unit-tested. Never SUGGESTS a Lagerklasse (judgment — Phase 1 does not compute
// one, §2 S5). When the matrix is empty the caller shows "keine
// Zusammenlagerungsregel hinterlegt" (honest gap, §3.15) — this function simply
// returns no flags and hasMatrix=false.

export type StorageCompatibilityRuleLite = {
  lagerklasseA: string;
  lagerklasseB: string;
  result: "ALLOWED" | "NOT_ALLOWED" | "CONDITIONAL";
  conditionNote?: string | null;
  tableRef?: string | null;
};

export type ZusammenlagerungFlag = {
  a: string;
  b: string;
  result: "NOT_ALLOWED" | "CONDITIONAL";
  conditionNote?: string | null;
  tableRef?: string | null;
};

export function checkZusammenlagerung(
  lagerklassen: string[],
  rules: StorageCompatibilityRuleLite[],
): { flags: ZusammenlagerungFlag[]; hasMatrix: boolean } {
  const present = [
    ...new Set(lagerklassen.map((l) => l.trim()).filter(Boolean)),
  ];
  if (rules.length === 0) return { flags: [], hasMatrix: false };

  // index rules by unordered pair key
  const byPair = new Map<string, StorageCompatibilityRuleLite>();
  for (const r of rules) {
    const a = r.lagerklasseA.trim();
    const b = r.lagerklasseB.trim();
    byPair.set([a, b].sort().join("|"), r);
  }

  const flags: ZusammenlagerungFlag[] = [];
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const a = present[i];
      const b = present[j];
      const rule = byPair.get([a, b].sort().join("|"));
      if (
        rule &&
        (rule.result === "NOT_ALLOWED" || rule.result === "CONDITIONAL")
      ) {
        flags.push({
          a,
          b,
          result: rule.result,
          conditionNote: rule.conditionNote ?? null,
          tableRef: rule.tableRef ?? null,
        });
      }
    }
  }
  return { flags, hasMatrix: true };
}
