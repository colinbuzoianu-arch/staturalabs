import "server-only";

import { getAiModel, getAnthropicClient } from "@/lib/ai/anthropic";
import { recordAiUsage } from "@/lib/ai/usage";
import type { SdsHint } from "./sds-consistency";
import type { ConfirmedSdsData } from "./sds-extraction-schema";

// P15 S3: the AI writes a plain-German EXPLANATION of each deterministic hint
// ("Das SDB nennt H225, aber …"). It can only explain — it never changes a
// result (the hints come from checkSdsConsistency, which is pure). Gated behind
// the KI-Funktionen entitlement at the call site; this function assumes it may
// run. Returns a code→text map; a parse/API failure returns {} so the UI simply
// falls back to the static reason text (never blocks the page). Never produces a
// regulatory number or a new classification — it describes the hint only.

const SYSTEM = [
  "Du erklärst Prüfhinweise zu einem Sicherheitsdatenblatt (SDB) in einfachem Deutsch.",
  "Für jeden Hinweis: ein bis zwei Sätze, die konkret auf die genannten SDB-Werte Bezug nehmen.",
  "Du bewertest nicht neu und nennst keine eigenen Grenzwerte, Einstufungen oder Zahlen — du erklärst nur, warum der Hinweis erscheint.",
  'Antworte NUR mit einem JSON-Objekt { "<hint-code>": "<Erklärung>" }, ohne weiteren Text.',
].join("\n");

export async function explainSdsHints(
  hints: SdsHint[],
  confirmed: ConfirmedSdsData,
  companyId?: string,
): Promise<Record<string, string>> {
  if (hints.length === 0) return {};
  const context = {
    signalWord: confirmed.signalWord,
    statementCodes: confirmed.statementCodes,
    pictograms: confirmed.pictograms,
    flashPoint: confirmed.flashPoint,
    language: confirmed.language,
    revisionDate: confirmed.revisionDate,
    marinePollutant: confirmed.marinePollutant,
    componentCount: confirmed.components.length,
  };
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: getAiModel(),
      max_tokens: 1500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `SDB-Werte: ${JSON.stringify(context)}\n\nHinweis-Codes: ${JSON.stringify(hints.map((h) => h.code))}\n\nErkläre jeden Code.`,
        },
      ],
    });
    if (companyId) {
      await recordAiUsage({
        companyId,
        feature: "hint-explanation",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    let t = text;
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
    if (fence) t = fence[1].trim();
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
    const parsed = JSON.parse(t) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}
