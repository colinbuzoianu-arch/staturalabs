import "server-only";

import type { ReferencePropertyType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// P15 S6: raw-material property database. Reads PubChem (public-domain) for a
// CAS: CID + molecular formula + IUPAC name, and the experimental physical
// properties VERBATIM (never numerically re-parsed, §0.7) with the PubChem
// source name as provenance. A property value without a resolvable source is
// skipped (the "public-domain / skip depositor-restricted" rule, §2 S6).
// Shown as "Referenzdaten" next to a substance; never replaces its SDS values.

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest";

const HEADINGS: { type: ReferencePropertyType; heading: string }[] = [
  { type: "FLASH_POINT", heading: "Flash Point" },
  { type: "BOILING_POINT", heading: "Boiling Point" },
  { type: "MELTING_POINT", heading: "Melting Point" },
  { type: "DENSITY", heading: "Density" },
  { type: "VAPOR_PRESSURE", heading: "Vapor Pressure" },
  { type: "WATER_SOLUBILITY", heading: "Solubility" },
];

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveCid(cas: string): Promise<number | null> {
  const j = (await getJson(
    `${PUG}/pug/compound/xref/RN/${encodeURIComponent(cas)}/cids/JSON`,
  )) as { IdentifierList?: { CID?: number[] } } | null;
  return j?.IdentifierList?.CID?.[0] ?? null;
}

type PugViewSection = {
  TOCHeading?: string;
  Section?: PugViewSection[];
  Information?: {
    ReferenceNumber?: number;
    Value?: { StringWithMarkup?: { String?: string }[] };
  }[];
};

function findSection(
  sections: PugViewSection[] | undefined,
  heading: string,
): PugViewSection | null {
  if (!sections) return null;
  for (const s of sections) {
    if (s.TOCHeading === heading) return s;
    const nested = findSection(s.Section, heading);
    if (nested) return nested;
  }
  return null;
}

// Fetch up to `max` verbatim values for one property heading, each with its
// resolved PubChem source name. Values without a source are skipped.
async function fetchProperty(
  cid: number,
  heading: string,
  max = 6,
): Promise<{ valueText: string; sourceName: string }[]> {
  const j = (await getJson(
    `${PUG}/pug_view/data/compound/${cid}/JSON?heading=${encodeURIComponent(heading)}`,
  )) as {
    Record?: {
      Section?: PugViewSection[];
      Reference?: { ReferenceNumber?: number; SourceName?: string }[];
    };
  } | null;
  if (!j?.Record) return [];
  const refMap = new Map<number, string>();
  for (const r of j.Record.Reference ?? []) {
    if (r.ReferenceNumber != null && r.SourceName)
      refMap.set(r.ReferenceNumber, r.SourceName);
  }
  const section = findSection(j.Record.Section, heading);
  if (!section?.Information) return [];
  const out: { valueText: string; sourceName: string }[] = [];
  const seen = new Set<string>();
  for (const info of section.Information) {
    const str = info.Value?.StringWithMarkup?.[0]?.String?.trim();
    if (!str) continue;
    const source =
      info.ReferenceNumber != null
        ? refMap.get(info.ReferenceNumber)
        : undefined;
    if (!source) continue; // skip values without a resolvable source
    if (seen.has(str)) continue;
    seen.add(str);
    out.push({ valueText: str, sourceName: source });
    if (out.length >= max) break;
  }
  return out;
}

export async function importReferenceSubstanceFromPubChem(
  cas: string,
): Promise<
  | { ok: true; cid: number; propertyCount: number }
  | { ok: false; reason: string }
> {
  const cid = await resolveCid(cas);
  if (!cid) return { ok: false, reason: `no PubChem CID for CAS ${cas}` };

  const propJson = (await getJson(
    `${PUG}/pug/compound/cid/${cid}/property/MolecularFormula,IUPACName/JSON`,
  )) as {
    PropertyTable?: {
      Properties?: { MolecularFormula?: string; IUPACName?: string }[];
    };
  } | null;
  const props = propJson?.PropertyTable?.Properties?.[0];

  const properties: {
    type: ReferencePropertyType;
    valueText: string;
    sourceName: string;
  }[] = [];
  for (const { type, heading } of HEADINGS) {
    const values = await fetchProperty(cid, heading);
    for (const v of values)
      properties.push({
        type,
        valueText: v.valueText,
        sourceName: v.sourceName,
      });
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.referenceSubstance.findUnique({
      where: { casNumber: cas },
      select: { id: true },
    });
    const ref = existing
      ? await tx.referenceSubstance.update({
          where: { id: existing.id },
          data: {
            nameEn: props?.IUPACName ?? cas,
            molecularFormula: props?.MolecularFormula ?? null,
            pubchemCid: cid,
            sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
            importedAt: new Date(),
          },
          select: { id: true },
        })
      : await tx.referenceSubstance.create({
          data: {
            casNumber: cas,
            nameEn: props?.IUPACName ?? cas,
            molecularFormula: props?.MolecularFormula ?? null,
            pubchemCid: cid,
            source: "PubChem",
            sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
            importedAt: new Date(),
          },
          select: { id: true },
        });
    await tx.referenceSubstanceProperty.deleteMany({
      where: { referenceSubstanceId: ref.id },
    });
    if (properties.length > 0) {
      await tx.referenceSubstanceProperty.createMany({
        data: properties.map((p) => ({
          referenceSubstanceId: ref.id,
          propertyType: p.type,
          valueText: p.valueText,
          sourceName: p.sourceName,
        })),
      });
    }
  });

  return { ok: true, cid, propertyCount: properties.length };
}

export type ReferenceData = {
  nameEn: string;
  molecularFormula: string | null;
  pubchemCid: number | null;
  sourceUrl: string | null;
  properties: {
    propertyType: ReferencePropertyType;
    valueText: string;
    sourceName: string;
  }[];
};

export async function getReferenceSubstanceByCas(
  cas: string | null,
): Promise<ReferenceData | null> {
  if (!cas?.trim()) return null;
  const row = await prisma.referenceSubstance.findUnique({
    where: { casNumber: cas.trim() },
    select: {
      nameEn: true,
      molecularFormula: true,
      pubchemCid: true,
      sourceUrl: true,
      properties: {
        orderBy: { propertyType: "asc" },
        select: { propertyType: true, valueText: true, sourceName: true },
      },
    },
  });
  return row ?? null;
}
