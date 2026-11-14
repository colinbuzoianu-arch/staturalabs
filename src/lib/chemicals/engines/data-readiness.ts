// P16 §3.2: per-engine data readiness. Pure — given what a product has, say which
// engine can run and which inputs are missing. The "Datenbasis" panel shows this,
// and each engine REFUSES (never guesses) when its inputs are absent.

export type ReadinessComponent = {
  hasConcentration: boolean;
  hasClassificationOrAte: boolean;
  hasDensity: boolean;
  hasWgk: boolean;
};

export type ReadinessInput = {
  components: ReadinessComponent[];
  hStatementCodes: string[];
  unNumber: string | null;
  flashPointKnown: boolean;
};

export type EngineReadiness = {
  engineKey: string;
  ready: boolean;
  missing: string[];
};

export function assessEngineReadiness(
  input: ReadinessInput,
): EngineReadiness[] {
  const comps = input.components;
  const hasComps = comps.length > 0;
  const allConc = hasComps && comps.every((c) => c.hasConcentration);

  const out: EngineReadiness[] = [];

  // CLP mixture classification
  {
    const missing: string[] = [];
    if (!hasComps) missing.push("components");
    else {
      if (!allConc) missing.push("component concentrations");
      if (!comps.some((c) => c.hasClassificationOrAte))
        missing.push("component classification/ATE");
    }
    out.push({
      engineKey: "clp.mixtureCalculation",
      ready: missing.length === 0,
      missing,
    });
  }

  // Physical estimates
  {
    const missing: string[] = [];
    if (!hasComps) missing.push("components");
    else {
      if (!allConc) missing.push("component concentrations");
      if (!comps.every((c) => c.hasDensity))
        missing.push("component densities");
    }
    out.push({
      engineKey: "mixture.physicalEstimates",
      ready: missing.length === 0,
      missing,
    });
  }

  // WGK mixture
  {
    const missing: string[] = [];
    if (!hasComps) missing.push("components");
    else {
      if (!allConc) missing.push("component concentrations");
      if (!comps.some((c) => c.hasWgk)) missing.push("component WGK");
    }
    out.push({
      engineKey: "wgk.mixtureCalculation",
      ready: missing.length === 0,
      missing,
    });
  }

  // Lagerklasse suggestion
  out.push({
    engineKey: "storage.lagerklasseSuggestion",
    ready: input.hStatementCodes.length > 0,
    missing: input.hStatementCodes.length > 0 ? [] : ["H-statements"],
  });

  // Transport / UN lookup
  out.push({
    engineKey: "transport.classification",
    ready: Boolean(input.unNumber),
    missing: input.unNumber ? [] : ["UN number"],
  });

  // SDS authoring — always produces a draft from whatever is available.
  out.push({ engineKey: "sds.authoring", ready: true, missing: [] });

  return out;
}
