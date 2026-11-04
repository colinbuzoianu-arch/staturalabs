// P7b person CSV import (SLD_P7_COMPARTMENT_DESIGN_NOTE.md / plan §7.7). Pure
// core — no DB, no `server-only` — shared by the client dry-run preview and
// the server commit (which re-parses and re-validates, never trusting the
// client). Unit-tested directly.

// The importable Person fields (exactly the §3.2 minimal set).
export type PersonField =
  | "firstName"
  | "lastName"
  | "personnelNumber"
  | "orgUnitName"
  | "employmentStart";

export type ColumnMapping = Partial<Record<PersonField, number>>;

// Header aliases per field (lower-cased, trimmed). Auto-detection matches a
// CSV header cell against these; unknown headers are ignored.
const HEADER_ALIASES: Record<PersonField, string[]> = {
  firstName: ["firstname", "first name", "vorname", "prenume"],
  lastName: ["lastname", "last name", "surname", "nachname", "nume"],
  personnelNumber: [
    "personnelnumber",
    "personnel number",
    "personalnummer",
    "personalnr",
    "numar personal",
    "număr de personal",
  ],
  orgUnitName: [
    "orgunit",
    "org unit",
    "organisationseinheit",
    "abteilung",
    "unitate",
  ],
  employmentStart: [
    "employmentstart",
    "employment start",
    "eintrittsdatum",
    "eintritt",
    "data angajarii",
    "data angajării",
  ],
};

// A forgiving RFC-4180-ish CSV parser: handles quoted fields, escaped quotes
// ("") and commas/newlines inside quotes. Returns rows of string cells.
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
  // Trailing cell/row (no final newline).
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// Given a header row, auto-detect which column holds each field.
export function autoDetectMapping(header: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  header.forEach((raw, index) => {
    const cell = raw.trim().toLowerCase();
    for (const field of Object.keys(HEADER_ALIASES) as PersonField[]) {
      if (
        mapping[field] === undefined &&
        HEADER_ALIASES[field].includes(cell)
      ) {
        mapping[field] = index;
      }
    }
  });
  return mapping;
}

export type ImportAction = "create" | "update" | "error";

export type ImportRowResult = {
  rowNumber: number; // 1-based, excluding the header
  action: ImportAction;
  reason?: string;
  values: {
    firstName: string;
    lastName: string;
    personnelNumber: string | null;
    orgUnitId: string | null;
    employmentStart: string | null; // ISO yyyy-mm-dd, or null
  };
  // Set for an "update": the existing person's id.
  existingPersonId?: string;
};

export type ImportPlan = {
  rows: ImportRowResult[];
  summary: { create: number; update: number; error: number };
};

export type ImportContext = {
  // personnelNumber (trimmed) -> existing person id, for the company.
  existingByPersonnelNumber: Map<string, string>;
  // org unit name (trimmed, lower-cased) -> org unit id, for the company.
  orgUnitIdByName: Map<string, string>;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Build the dry-run plan from parsed data rows (header already removed).
export function buildImportPlan(
  dataRows: readonly string[][],
  mapping: ColumnMapping,
  ctx: ImportContext,
): ImportPlan {
  const rows: ImportRowResult[] = [];
  const summary = { create: 0, update: 0, error: 0 };

  const cellAt = (row: readonly string[], col: number | undefined) =>
    col === undefined ? "" : (row[col] ?? "").trim();

  dataRows.forEach((row, i) => {
    const firstName = cellAt(row, mapping.firstName);
    const lastName = cellAt(row, mapping.lastName);
    const personnelNumber = cellAt(row, mapping.personnelNumber) || null;
    const orgUnitName = cellAt(row, mapping.orgUnitName) || null;
    const employmentStartRaw = cellAt(row, mapping.employmentStart) || null;

    const values = {
      firstName,
      lastName,
      personnelNumber,
      orgUnitId: null as string | null,
      employmentStart: null as string | null,
    };

    const fail = (reason: string): void => {
      summary.error++;
      rows.push({ rowNumber: i + 1, action: "error", reason, values });
    };

    if (!firstName || !lastName) {
      fail("missing-name");
      return;
    }
    if (orgUnitName) {
      const id = ctx.orgUnitIdByName.get(orgUnitName.toLowerCase());
      if (!id) {
        fail("unknown-org-unit");
        return;
      }
      values.orgUnitId = id;
    }
    if (employmentStartRaw) {
      if (!ISO_DATE.test(employmentStartRaw)) {
        fail("invalid-date");
        return;
      }
      values.employmentStart = employmentStartRaw;
    }

    const existingId = personnelNumber
      ? ctx.existingByPersonnelNumber.get(personnelNumber)
      : undefined;
    if (existingId) {
      summary.update++;
      rows.push({
        rowNumber: i + 1,
        action: "update",
        values,
        existingPersonId: existingId,
      });
    } else {
      summary.create++;
      rows.push({ rowNumber: i + 1, action: "create", values });
    }
  });

  return { rows, summary };
}
