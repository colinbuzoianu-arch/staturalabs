// DOK-VO/§5 ASchG requires the SGD to name the ÖNORMEN, harmonised European
// standards, or other recognised technical rules used to derive measures
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B5 item 6). SLD's scoring
// methodology is independently designed and merely "inspired by" these
// public standards (ERGO_COMPLIANCE_BY_DESIGN.md §3.7, CLAUDE.md's scoring-
// methodology section) — never a reproduction or claim of conformance — so
// this document names what it draws conceptual inspiration from, not a
// certification.
//
// "Generated from the methodology version's own rule set, not hardcoded"
// (plan §7 B5): the pure function below only returns an entry when the
// caller confirms the corresponding rule table actually has rows for the
// methodology version in scope — it does not unconditionally list every
// standard SLD has ever drawn on.
export type AppliedStandard = {
  reference: string;
  appliesTo: string;
  note: string;
};

export function deriveAppliedStandards(params: {
  hasScoringRules: boolean;
  hasHoldTimeRules: boolean;
  hasManualHandlingRules: boolean;
}): AppliedStandard[] {
  const standards: AppliedStandard[] = [];

  if (params.hasScoringRules) {
    standards.push({
      reference: "ISO 11228 (Ergonomie – Manuelle Handhabung)",
      appliesTo: "Körperhaltung / Gelenkwinkel-Bewertung",
      note: "SLD-Methodik ist eigenständig entwickelt und an diesen Normen orientiert (nicht deren Reproduktion oder Zertifizierung).",
    });
    standards.push({
      reference:
        "EN 1005-4 (Sicherheit von Maschinen – Menschliche körperliche Leistung – Teil 4: Bewertung von Körperhaltungen und Bewegungen bei der Arbeit an Maschinen)",
      appliesTo: "Körperhaltung / Gelenkwinkel-Bewertung",
      note: "SLD-Methodik ist eigenständig entwickelt und an diesen Normen orientiert (nicht deren Reproduktion oder Zertifizierung).",
    });
  }

  if (params.hasHoldTimeRules) {
    standards.push({
      reference:
        "ISO 11226 (Ergonomie – Bewertung von statischen Arbeitshaltungen)",
      appliesTo: "Haltedauer-Bewertung",
      note: "SLD-eigene Schwellenwerte, am allgemeinen Prinzip dieser Norm orientiert (nicht deren Reproduktion).",
    });
  }

  // §7 B8: §64 ASchG requires manual load handling to be evaluated but
  // Austria has no Lastenhandhabungsverordnung — no mandated method. This
  // entry is the SGD naming the one SLD uses, per the plan's explicit
  // instruction ("Note in the SGD that Austria prescribes no method, and
  // name the one used. That sentence is a selling point, not a hedge.").
  if (params.hasManualHandlingRules) {
    standards.push({
      reference:
        "ISO 11228-1 / EN 1005-2 (Manuelle Handhabung – Heben und Tragen)",
      appliesTo: "Bewertung der manuellen Lastenhandhabung (§64 ASchG)",
      note: "Österreich schreibt für §64 ASchG keine Methode vor (keine Lastenhandhabungsverordnung) — SLD wendet eigene, an dieser Norm orientierte Schwellenwerte an (nicht deren Reproduktion).",
    });
  }

  return standards;
}
