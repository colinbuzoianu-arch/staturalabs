import "server-only";

import type { CountryCode, EngineFlagState } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  conservativeConcentrationPct,
  parseNumericProperty,
} from "../mixture-composition";
import { checkSdsConsistency } from "../sds-consistency";
import {
  buildConfirmedPayload,
  type ConfirmedSdsData,
  emptySdsExtraction,
} from "../sds-extraction-schema";
import { computeAteMix } from "./clp-mixture";
import { resolveEngineFlagState } from "./engine-flags";
import { suggestLagerklasse } from "./lagerklasse-suggestion";
import {
  estimateBoilingRangeLowerBound,
  estimateFlashPoint,
  estimateMixtureDensity,
  type MixtureComponent as PhysComponent,
} from "./physical-estimates";
import { lookupUnEntry } from "./transport-classification";
import { computeMixtureWgk } from "./wgk-mixture";

// P16 §4: build the "Prüfung & Berechnung" comparison — engine output NEXT TO what
// the SDS declares (never overwriting). Only PREVIEW+ engines are returned.
// Engines that need regulatory config not loaded here (CLP full classification,
// WGK, Lagerklasse) refuse honestly ("Regelwerk/Konfiguration nicht geladen");
// physical estimates, CLP ATE-mix, transport and the deterministic S3 deviations
// produce real output.

export type ComparisonStatus = "match" | "deviation" | "info";
export type ComparisonRow = {
  label: string;
  sdsValue: string | null;
  engineValue: string | null;
  status: ComparisonStatus;
};
export type EngineComparison = {
  engineKey: string;
  state: EngineFlagState;
  rows: ComparisonRow[];
  refusedReason: string | null;
};

function num(s: string | null | undefined): number | null {
  return parseNumericProperty(s ?? null);
}

// P16 §4 (site overview): products with at least one engine↔SDS deviation.
export type SiteDeviation = {
  substanceId: string;
  tradeName: string;
  items: string[];
};

export async function getSiteDeviations(
  companyId: string,
  country: CountryCode,
): Promise<SiteDeviation[]> {
  // Only substances with a confirmed SDS can deviate; bound the work to those.
  const subs = await prisma.substance.findMany({
    where: { companyId, safetyDataSheets: { some: { supersededAt: null } } },
    select: { id: true, tradeName: true },
    orderBy: { tradeName: "asc" },
  });
  const out: SiteDeviation[] = [];
  for (const s of subs) {
    const comparisons = await getEngineComparisons(s.id, companyId, country);
    const items = comparisons.flatMap((c) =>
      c.rows
        .filter((r) => r.status === "deviation")
        .map((r) => `${c.engineKey}: ${r.label}`),
    );
    if (items.length > 0)
      out.push({ substanceId: s.id, tradeName: s.tradeName, items });
  }
  return out;
}

export async function getEngineComparisons(
  substanceId: string,
  companyId: string,
  country: CountryCode,
): Promise<EngineComparison[]> {
  const sub = await prisma.substance.findFirst({
    where: { id: substanceId, companyId },
    include: {
      statements: { select: { kind: true, code: true } },
      mixtureComponents: true,
      safetyDataSheets: {
        where: { supersededAt: null },
        orderBy: { revisionDate: "desc" },
        take: 1,
        select: { confirmedData: true },
      },
    },
  });
  if (!sub) return [];
  const storedConfirmed =
    (sub.safetyDataSheets[0]
      ?.confirmedData as Partial<ConfirmedSdsData> | null) ?? null;
  // Normalise over an empty payload so array fields are always present (a stored
  // payload may be partial); null when there is no confirmed SDS at all.
  const confirmed: ConfirmedSdsData | null = storedConfirmed
    ? { ...buildConfirmedPayload(emptySdsExtraction()), ...storedConfirmed }
    : null;
  const comps = sub.mixtureComponents;

  async function state(key: string): Promise<EngineFlagState> {
    return resolveEngineFlagState(key, companyId);
  }
  const out: EngineComparison[] = [];
  const add = (c: EngineComparison) => {
    if (c.state !== "OFF") out.push(c);
  };

  // --- CLP mixture: ATE-mix (computable) + S3 deviations; full classification pending config ---
  {
    const s = await state("clp.mixtureCalculation");
    const rows: ComparisonRow[] = [];
    const ate = computeAteMix(
      comps.map((c) => ({
        concentrationPct: conservativeConcentrationPct(c).value ?? 0,
        ate: c.ateOral,
      })),
    );
    if (ate.value)
      rows.push({
        label: "ATE (oral)",
        sdsValue: null,
        engineValue: ate.value.ateMix.toFixed(0),
        status: "info",
      });
    if (confirmed) {
      const hints = checkSdsConsistency(confirmed, {
        siteRequiresDe: country === "AT" || country === "DE",
        now: new Date(),
        staleYears: 3,
      });
      for (const h of hints) {
        rows.push({
          label: h.code,
          sdsValue: null,
          engineValue: null,
          status: "deviation",
        });
      }
    }
    add({
      engineKey: "clp.mixtureCalculation",
      state: s,
      rows,
      refusedReason: "Volleinstufung: CLP-Konfiguration nicht geladen",
    });
  }

  // --- Physical estimates (real physics) ---
  {
    const s = await state("mixture.physicalEstimates");
    const physComps: PhysComponent[] = comps.map((c) => ({
      name: c.name,
      massFraction: (conservativeConcentrationPct(c).value ?? 0) / 100,
      density: c.densityGCm3,
      boilingPoint: c.boilingPointC,
      flashPoint: c.flashPointC,
    }));
    const density = estimateMixtureDensity(physComps);
    const boiling = estimateBoilingRangeLowerBound(physComps);
    const flash = estimateFlashPoint(physComps);
    const sdsFlash = num(confirmed?.flashPoint);
    const flashDeviation =
      flash.value != null &&
      sdsFlash != null &&
      Math.abs(flash.value - sdsFlash) > 5;
    const rows: ComparisonRow[] = [
      {
        label: "Dichte",
        sdsValue: confirmed?.density ?? null,
        engineValue:
          density.value != null
            ? `${density.value.toFixed(3)} g/cm³`
            : "nicht berechenbar",
        status: "info",
      },
      {
        label: "Siedebeginn (untere Grenze)",
        sdsValue: confirmed?.boilingPoint ?? null,
        engineValue:
          boiling.value != null ? `${boiling.value} °C` : "nicht berechenbar",
        status: "info",
      },
      {
        label: "Flammpunkt",
        sdsValue: confirmed?.flashPoint ?? null,
        engineValue:
          flash.value != null ? `${flash.value} °C` : "nicht berechenbar",
        status: flashDeviation ? "deviation" : "info",
      },
    ];
    add({
      engineKey: "mixture.physicalEstimates",
      state: s,
      rows,
      refusedReason: null,
    });
  }

  // --- WGK mixture (DE) — AwSV thresholds not loaded ---
  {
    const s = await state("wgk.mixtureCalculation");
    const r = computeMixtureWgk(
      comps.map((c) => ({
        concentrationPct: conservativeConcentrationPct(c).value ?? 0,
        wgk: (c.wgk as 1 | 2 | 3 | null) ?? null,
      })),
      null,
    );
    add({
      engineKey: "wgk.mixtureCalculation",
      state: s,
      rows: [
        {
          label: "WGK",
          sdsValue: confirmed?.wgk ?? null,
          engineValue: null,
          status: "info",
        },
      ],
      refusedReason: r.unavailableReason ?? "AwSV-Schwellen nicht geladen",
    });
  }

  // --- Lagerklasse suggestion (DE) — TRGS 510 scheme not loaded ---
  {
    const s = await state("storage.lagerklasseSuggestion");
    const r = suggestLagerklasse(
      {
        hCodes: sub.statements.filter((x) => x.kind === "H").map((x) => x.code),
        pictograms: [],
      },
      [],
    );
    add({
      engineKey: "storage.lagerklasseSuggestion",
      state: s,
      rows: [
        {
          label: "Lagerklasse",
          sdsValue: confirmed?.lagerklasse ?? null,
          engineValue: null,
          status: "info",
        },
      ],
      refusedReason: r.unavailableReason ?? "TRGS 510-Schema nicht geladen",
    });
  }

  // --- Transport (DEMO_LIST) ---
  {
    const s = await state("transport.classification");
    const un = confirmed?.unNumber ?? null;
    const hit = un ? lookupUnEntry(un) : null;
    const rows: ComparisonRow[] = [
      {
        label: "UN-Nummer",
        sdsValue: un,
        engineValue: hit?.value?.unNumber ?? null,
        status: "info",
      },
      {
        label: "Klasse",
        sdsValue: confirmed?.transportClass ?? null,
        engineValue: hit?.value?.transportClass ?? null,
        status: "info",
      },
      {
        label: "Verpackungsgruppe",
        sdsValue: confirmed?.packingGroup ?? null,
        engineValue: hit?.value?.packingGroup ?? null,
        status: "info",
      },
    ];
    add({
      engineKey: "transport.classification",
      state: s,
      rows,
      refusedReason:
        un && !hit?.value
          ? "Gefahrgutliste nicht geladen (Eintrag nicht in der Demo-Liste)"
          : null,
    });
  }

  return out;
}
