import "server-only";

import {
  AiNotEnabledError,
  getAiModel,
  getAnthropicClient,
  isGefahrstoffeAiAvailable,
} from "@/lib/ai/anthropic";
import { recordAiUsage } from "@/lib/ai/usage";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import type { ConfirmedSdsData } from "./sds-extraction-schema";

// P15 S7: draft the four free-text Betriebsanweisung sections with AI, ONLY from
// the confirmed SDS sections (4/5/6/7/8/13) of that product plus the P6 measure
// catalogue. No information from outside the SDS (§2 S7). Each drafted section
// records which SDS sections it drew from. Output stays a DRAFT until approved.
// Gated behind the KI-Funktionen entitlement + metered.

export type BaDraftSection = { text: string; sources: string[] };
export type BaAiDraft = {
  protectiveMeasures: BaDraftSection;
  emergency: BaDraftSection;
  firstAid: BaDraftSection;
  disposal: BaDraftSection;
};

const SYSTEM = [
  "Du erstellst den Entwurf der vier Freitext-Abschnitte einer Betriebsanweisung nach § 14 GefStoffV / ASchG:",
  "protectiveMeasures (Schutzmaßnahmen und Verhaltensregeln), emergency (Verhalten im Gefahrfall), firstAid (Erste Hilfe), disposal (Sachgerechte Entsorgung).",
  "STRIKTE Regeln:",
  "1. Verwende AUSSCHLIESSLICH die übergebenen SDB-Abschnitte (4, 5, 6, 7, 8, 13) und die übergebene Maßnahmen-Bibliothek. Keine Information von außerhalb, kein eigenes Wissen.",
  "2. Wenn ein Abschnitt im SDB fehlt, schreibe einen kurzen Hinweis, dass die Angabe im SDB fehlt — erfinde nichts.",
  "3. Formuliere knapp, in Stichpunkten, auf Deutsch, für eine Betriebsanweisung am Arbeitsplatz.",
  '4. Gib je Abschnitt an, aus welchen SDB-Abschnittsnummern du geschöpft hast (Feld sources, z. B. ["4","6"]).',
  'Antworte NUR mit JSON: {"protectiveMeasures":{"text":"...","sources":["7","8"]},"emergency":{...},"firstAid":{...},"disposal":{...}}.',
].join("\n");

function parseDraft(text: string): BaAiDraft {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  const parsed = JSON.parse(t) as Record<
    string,
    { text?: unknown; sources?: unknown }
  >;
  const section = (k: string): BaDraftSection => {
    const s = parsed[k] ?? {};
    return {
      text: typeof s.text === "string" ? s.text.trim() : "",
      sources: Array.isArray(s.sources) ? s.sources.map((x) => String(x)) : [],
    };
  };
  return {
    protectiveMeasures: section("protectiveMeasures"),
    emergency: section("emergency"),
    firstAid: section("firstAid"),
    disposal: section("disposal"),
  };
}

export async function draftOperatingInstruction(input: {
  operatingInstructionId: string;
  companyId: string;
  actorUserId: string;
}): Promise<BaAiDraft> {
  if (!(await isGefahrstoffeAiAvailable(input.companyId)))
    throw new AiNotEnabledError();

  const oi = await prisma.operatingInstruction.findUnique({
    where: { id: input.operatingInstructionId },
    include: {
      site: { select: { companyId: true } },
      substance: {
        select: {
          tradeName: true,
          safetyDataSheets: {
            orderBy: { revisionDate: "desc" },
            take: 1,
            select: { confirmedData: true },
          },
        },
      },
    },
  });
  if (!oi || oi.site.companyId !== input.companyId)
    throw new Error("OperatingInstruction not in company");
  if (oi.status !== "DRAFT") throw new Error("Only a DRAFT can be AI-drafted");

  const confirmed = oi.substance.safetyDataSheets[0]?.confirmedData as
    | ConfirmedSdsData
    | null
    | undefined;
  const sdsSections = {
    section4FirstAid: confirmed?.section4FirstAid ?? null,
    section5FireFighting: confirmed?.section5FireFighting ?? null,
    section6AccidentalRelease: confirmed?.section6AccidentalRelease ?? null,
    section7HandlingStorage: confirmed?.section7HandlingStorage ?? null,
    section8ExposureControls: confirmed
      ? { limits: confirmed.citedLimits }
      : null,
    section13Disposal: confirmed?.section13Disposal ?? null,
  };

  // P6 typical measures for CHEMICAL hazards as additional context.
  const measures = await prisma.typicalMeasure.findMany({
    where: { hazardCategory: "CHEMICAL" },
    orderBy: { order: "asc" },
    select: { measureDe: true, hierarchyOfControl: true },
    take: 40,
  });

  const client = getAnthropicClient();
  const model = getAiModel();
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Produkt: ${oi.substance.tradeName}\n\nSDB-Abschnitte:\n${JSON.stringify(sdsSections)}\n\nMaßnahmen-Bibliothek (P6):\n${JSON.stringify(measures)}\n\nErstelle den Entwurf.`,
      },
    ],
  });

  await recordAiUsage({
    companyId: input.companyId,
    feature: "ba-drafting",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  const draft = parseDraft(text);

  await prisma.operatingInstruction.update({
    where: { id: input.operatingInstructionId },
    data: {
      aiDraft: draft as unknown as object,
      draftedByAiAt: new Date(),
      draftModel: model,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "operating_instruction.ai_draft",
    entityType: "OperatingInstruction",
    entityId: input.operatingInstructionId,
    companyId: input.companyId,
  });

  return draft;
}
