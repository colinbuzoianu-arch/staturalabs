import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { isFeatureEnabled } from "@/lib/admin/feature-flags";
import { isWithinAiCap } from "@/lib/ai/usage";

// P15 S2/S3/S7: the one server-side Anthropic client seam. AI is used only
// inside fixed functions (SDS extraction, hint explanations, Betriebsanweisung
// drafts) — never a free conversational agent (§0.6) — and only when the tenant
// has the KI-Funktionen entitlement AND a key is configured. Model is set by env
// var (§2 S2), defaulting to the current Opus. Key read from ANTHROPIC_API_KEY
// by the SDK itself. No worker data is ever sent (SDS are product documents).

// The KI-Funktionen Gefahrstoffe entitlement flag (S8, super-admin module matrix,
// default OFF for new tenants).
export const GEFAHRSTOFFE_AI_FLAG = "chemicals.ai";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured (ANTHROPIC_API_KEY is unset)");
    this.name = "AiNotConfiguredError";
  }
}

export class AiNotEnabledError extends Error {
  constructor() {
    super("KI-Funktionen Gefahrstoffe is not enabled for this tenant");
    this.name = "AiNotEnabledError";
  }
}

export function getAiModel(): string {
  return process.env.GEFAHRSTOFFE_AI_MODEL?.trim() || "claude-opus-5-5";
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  if (!cached) cached = new Anthropic();
  return cached;
}

// The gate every AI feature calls first: key present AND tenant entitled.
// Manual entry keeps working regardless; this only decides whether AI runs.
export async function isGefahrstoffeAiAvailable(
  companyId: string,
): Promise<boolean> {
  if (!isAiConfigured()) return false;
  if (!(await isFeatureEnabled(GEFAHRSTOFFE_AI_FLAG, companyId))) return false;
  // S8: an exhausted monthly cap pauses AI (manual entry still works).
  return isWithinAiCap(companyId);
}
