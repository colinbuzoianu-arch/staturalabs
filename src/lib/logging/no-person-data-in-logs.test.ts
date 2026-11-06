import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// P13 §6: structured logging must carry no person data — tenant/site/entity ids
// and event types only, never a worker name, email or health detail. This test
// is the lint: it scans every console.* call in src/ and fails if the SAME line
// references an obvious person field. Heuristic, deliberately strict; if a false
// positive ever appears, log an id instead of the object.

const SRC = join(process.cwd(), "src");
const PERSON_TOKENS =
  /\b(firstName|lastName|personnelNumber|\.email\b|diagnosis|treatmentNotes|medicalHistory|dateOfBirth)\b/;
const CONSOLE_CALL = /console\.(log|info|warn|error|debug)\s*\(/;

function collect(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "generated" || name === "node_modules") continue;
      collect(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
}

describe("no person data in log calls (§6)", () => {
  it("never logs an obvious person field in a console.* call", () => {
    const files: string[] = [];
    collect(SRC, files);
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (CONSOLE_CALL.test(line) && PERSON_TOKENS.test(line)) {
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
