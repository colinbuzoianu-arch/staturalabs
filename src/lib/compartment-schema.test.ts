import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Compartment guard (ERGO_COMPLIANCE_BY_DESIGN.md §3.18(a),
// SLD_RESTRUCTURE_PLAN_platform-modules.md §3.1): the assessment chain must
// NEVER hold a relation into the people compartment. The people-compartment
// models (Person, PersonAssignment, TrainingRecord, Incident, health
// sub-compartment, …) don't exist yet — they arrive in P7/P10 — so today this
// test passes trivially. Its job is to be the tripwire the mandate requires:
// the moment someone adds `Person` and wires, say, `person Person @relation`
// onto Workstation or RiskFinding, this test goes red and names the field.
//
// It parses prisma/schema.prisma into model blocks (no Prisma runtime
// needed) and checks that no assessment-chain model references a
// forbidden person-compartment model type.

const SCHEMA_PATH = join(process.cwd(), "prisma", "schema.prisma");

// The person-free assessment chain (§1, §3.1). If one of these is renamed the
// test fails here, which is the right prompt to re-confirm the invariant for
// the new name rather than silently stop guarding it.
const ASSESSMENT_CHAIN_MODELS = [
  "Workstation",
  "Task",
  "PostureSample",
  "PostureZoneScore",
  "BodyRegionScore",
  "AssessmentSession",
  "RiskAssessment",
  "RiskFinding",
  "ExposureMeasurement",
  "EnvironmentalAssessment",
  "EnvironmentalFinding",
];

// Model names that would, if a person-free table pointed at them, break the
// compartment. These are the FUTURE people-compartment tables; listing them
// now makes the guard effective the instant they are introduced.
const FORBIDDEN_PERSON_MODELS = [
  "Person",
  "PersonAssignment",
  "TrainingRequirementType",
  "TrainingRecord",
  "TrainingSession",
  "Incident",
  "IncidentHealthDetail",
  "IncidentInvolvedPerson",
  "HealthRecord",
];

type ModelBlock = { name: string; body: string };

function parseModels(schema: string): ModelBlock[] {
  const blocks: ModelBlock[] = [];
  const re = /\bmodel\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = re.exec(schema)) !== null) {
    blocks.push({ name: m[1], body: m[2] });
  }
  return blocks;
}

describe("people compartment schema guard (§3.18)", () => {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const models = parseModels(schema);
  const byName = new Map(models.map((b) => [b.name, b]));

  it("still defines every assessment-chain model this guard covers", () => {
    for (const name of ASSESSMENT_CHAIN_MODELS) {
      expect(byName.has(name), `model ${name} missing from schema`).toBe(true);
    }
  });

  it("no assessment-chain model references a people-compartment model", () => {
    for (const modelName of ASSESSMENT_CHAIN_MODELS) {
      const block = byName.get(modelName);
      if (!block) continue;
      for (const forbidden of FORBIDDEN_PERSON_MODELS) {
        // Match the forbidden model name as a field type token (word-bounded),
        // which is how a relation would appear, e.g. `person Person`.
        const typeToken = new RegExp(`\\b${forbidden}\\b`);
        expect(
          typeToken.test(block.body),
          `${modelName} must not reference ${forbidden} (people-compartment leak, §3.18)`,
        ).toBe(false);
      }
    }
  });

  // P7 reverse assertion (SLD_P7_COMPARTMENT_DESIGN_NOTE.md §7): the people
  // compartment must not FK INTO the assessment chain either. The design
  // deliberately keeps person↔workstation/org-unit links as plain columns
  // (no @relation), so this holds absolutely with no carve-out. The moment
  // someone adds, say, `workstation Workstation @relation` to PersonAssignment,
  // this goes red and names the field.
  it("no people-compartment model references an assessment-chain model", () => {
    const peopleModelsPresent = FORBIDDEN_PERSON_MODELS.filter((name) =>
      byName.has(name),
    );
    for (const modelName of peopleModelsPresent) {
      const block = byName.get(modelName);
      if (!block) continue;
      for (const chainModel of ASSESSMENT_CHAIN_MODELS) {
        const typeToken = new RegExp(`\\b${chainModel}\\b`);
        expect(
          typeToken.test(block.body),
          `${modelName} must not reference ${chainModel} (people→assessment leak, §3.18(a))`,
        ).toBe(false);
      }
    }
  });

  it("AuditEvent carries no relation fields (append-only, outlives entities)", () => {
    const block = byName.get("AuditEvent");
    expect(block).toBeDefined();
    // No `@relation` anywhere in the AuditEvent model — companyId/siteId/
    // entityId/actorUserId are deliberately plain columns, not FKs.
    expect(block?.body.includes("@relation")).toBe(false);
  });
});
