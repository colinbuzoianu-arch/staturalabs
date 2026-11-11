// P14 G3: a reusable bulk-import pipeline — upload → column mapping → dry-run
// with per-row validation + error report → commit. Pure core (no DB, no
// `server-only`), shared by the client preview and the server commit (which
// re-parses and re-validates, never trusting the client), unit-tested directly.
// Generalises the P7 people CSV importer's discipline into one framework that
// each entity plugs an ImporterDefinition into.

// --- CSV parsing (RFC-4180-ish: quoted fields, "" escapes, commas/newlines in
// quotes). Returns rows of string cells. (Lifted from the P7 people importer so
// every importer shares one parser.)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// A field an importer reads from the CSV. `key` is the stable field id; `aliases`
// are lower-cased header cells that auto-map to it; `example` seeds the template.
export type ImportFieldSpec = {
  key: string;
  required: boolean;
  aliases: string[];
  example: string;
};

export type ColumnMapping = Record<string, number>;

// Auto-detect which column holds each field from the header row.
export function autoDetectMapping(
  header: readonly string[],
  fields: readonly ImportFieldSpec[],
): ColumnMapping {
  const mapping: ColumnMapping = {};
  header.forEach((raw, index) => {
    const cell = raw.trim().toLowerCase();
    for (const f of fields) {
      if (
        mapping[f.key] === undefined &&
        (cell === f.key.toLowerCase() || f.aliases.includes(cell))
      ) {
        mapping[f.key] = index;
      }
    }
  });
  return mapping;
}

// The result of validating one mapped row. "create"/"update" are commit-able;
// "error" carries a reason code (localised in the UI); "skip" is a valid no-op.
export type ImportRowStatus = "create" | "update" | "skip" | "error";

export type ImportRowResult<TValue> = {
  rowNumber: number; // 1-based, excluding the header
  status: ImportRowStatus;
  reason?: string;
  // The normalised, validated value for a create/update row (null otherwise).
  value: TValue | null;
  raw: Record<string, string>;
};

export type ImportPlan<TValue> = {
  rows: ImportRowResult<TValue>[];
  summary: { create: number; update: number; skip: number; error: number };
};

// What an entity plugs in: its fields + a pure row validator. The validator sees
// the mapped cells (by field key) and any context the entity needs (existing
// rows, resolvable names), and returns a status + normalised value or a reason.
export interface ImporterDefinition<TValue, TContext> {
  entity: string;
  fields: readonly ImportFieldSpec[];
  validateRow(
    cells: Record<string, string>,
    ctx: TContext,
  ):
    | { status: "create" | "update"; value: TValue }
    | { status: "skip"; reason?: string }
    | { status: "error"; reason: string };
}

// Build the dry-run plan from parsed data rows (header already removed).
export function buildPlan<TValue, TContext>(
  dataRows: readonly string[][],
  mapping: ColumnMapping,
  def: ImporterDefinition<TValue, TContext>,
  ctx: TContext,
): ImportPlan<TValue> {
  const rows: ImportRowResult<TValue>[] = [];
  const summary = { create: 0, update: 0, skip: 0, error: 0 };

  dataRows.forEach((row, i) => {
    const cells: Record<string, string> = {};
    for (const f of def.fields) {
      const col = mapping[f.key];
      cells[f.key] = col === undefined ? "" : (row[col] ?? "").trim();
    }
    const result = def.validateRow(cells, ctx);
    if (result.status === "error") {
      summary.error++;
      rows.push({
        rowNumber: i + 1,
        status: "error",
        reason: result.reason,
        value: null,
        raw: cells,
      });
    } else if (result.status === "skip") {
      summary.skip++;
      rows.push({
        rowNumber: i + 1,
        status: "skip",
        reason: result.reason,
        value: null,
        raw: cells,
      });
    } else {
      summary[result.status]++;
      rows.push({
        rowNumber: i + 1,
        status: result.status,
        value: result.value,
        raw: cells,
      });
    }
  });

  return { rows, summary };
}

// A downloadable template: header row of field keys + one example row. Prefixed
// with a UTF-8 BOM and CRLF line endings so Excel opens it cleanly (same as the
// KPI CSV export).
export function buildTemplateCsv(
  def: ImporterDefinition<unknown, unknown>,
): string {
  const esc = (s: string) =>
    /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const header = def.fields.map((f) => esc(f.key)).join(",");
  const example = def.fields.map((f) => esc(f.example)).join(",");
  return `﻿${header}\r\n${example}\r\n`;
}
