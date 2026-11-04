"use client";

import { useMemo, useState } from "react";
import {
  autoDetectMapping,
  buildImportPlan,
  type ImportContext,
  type PersonField,
  parseCsv,
} from "@/lib/people/csv-import";

// P7b person CSV import UI (SLD_P7_COMPARTMENT_DESIGN_NOTE.md / plan §7.7).
// Paste or load a CSV, auto-map columns by header, see a live dry-run preview
// (create / update / error per row), then import. The import re-parses and
// re-validates server-side from the same raw CSV (the client preview is never
// trusted). Mapping is header-name auto-detection in v1; manual re-mapping is
// a later refinement.

export type CsvImportLabels = {
  intro: string;
  pasteLabel: string;
  fileLabel: string;
  detectedMapping: string;
  notDetected: string;
  summary: string; // "{create} create, {update} update, {error} error"
  previewHeading: string;
  colRow: string;
  colAction: string;
  colName: string;
  colReason: string;
  importButton: string;
  nothingToImport: string;
  fieldLabels: Record<PersonField, string>;
  actionLabels: { create: string; update: string; error: string };
  reasonLabels: Record<string, string>;
};

export function PersonCsvImport({
  action,
  existingPersonnelNumbers,
  orgUnitsByName,
  labels,
}: {
  action: (formData: FormData) => void | Promise<void>;
  existingPersonnelNumbers: [string, string][];
  orgUnitsByName: [string, string][];
  labels: CsvImportLabels;
}) {
  const [csv, setCsv] = useState("");

  const ctx: ImportContext = useMemo(
    () => ({
      existingByPersonnelNumber: new Map(existingPersonnelNumbers),
      orgUnitIdByName: new Map(orgUnitsByName),
    }),
    [existingPersonnelNumbers, orgUnitsByName],
  );

  const parsed = useMemo(() => {
    const trimmed = csv.trim();
    if (!trimmed) return null;
    const rows = parseCsv(trimmed);
    if (rows.length < 2) return null;
    const [header, ...dataRows] = rows;
    const mapping = autoDetectMapping(header);
    const plan = buildImportPlan(dataRows, mapping, ctx);
    return { header, mapping, plan };
  }, [csv, ctx]);

  const canImport =
    parsed != null &&
    parsed.plan.summary.create + parsed.plan.summary.update > 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-foreground-muted">{labels.intro}</p>

      <label className="flex flex-col gap-1">
        {labels.fileLabel}
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
      </label>

      <label className="flex flex-col gap-1">
        {labels.pasteLabel}
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          className="rounded border border-border bg-background px-2 py-1 font-mono text-xs"
          placeholder="Vorname,Nachname,Personalnummer,Abteilung,Eintrittsdatum"
        />
      </label>

      {parsed && (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="font-semibold">{labels.detectedMapping}:</span>
            {(Object.keys(labels.fieldLabels) as PersonField[]).map((field) => (
              <span
                key={field}
                className="rounded bg-surface-raised px-1.5 py-0.5 text-xs"
              >
                {labels.fieldLabels[field]}:{" "}
                {parsed.mapping[field] !== undefined
                  ? parsed.header[parsed.mapping[field] as number]
                  : labels.notDetected}
              </span>
            ))}
          </div>

          <p className="font-medium">
            {labels.summary
              .replace("{create}", String(parsed.plan.summary.create))
              .replace("{update}", String(parsed.plan.summary.update))
              .replace("{error}", String(parsed.plan.summary.error))}
          </p>

          <div>
            <p className="mb-1 font-semibold">{labels.previewHeading}</p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-foreground-muted">
                  <th className="py-1 pr-3">{labels.colRow}</th>
                  <th className="py-1 pr-3">{labels.colAction}</th>
                  <th className="py-1 pr-3">{labels.colName}</th>
                  <th className="py-1">{labels.colReason}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.plan.rows.map((r) => (
                  <tr
                    key={r.rowNumber}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1 pr-3">{r.rowNumber}</td>
                    <td
                      className={`py-1 pr-3 ${
                        r.action === "error" ? "text-coral" : "text-foreground"
                      }`}
                    >
                      {labels.actionLabels[r.action]}
                    </td>
                    <td className="py-1 pr-3">
                      {r.values.firstName || r.values.lastName
                        ? `${r.values.lastName}, ${r.values.firstName}`
                        : "—"}
                    </td>
                    <td className="py-1 text-foreground-muted">
                      {r.reason
                        ? (labels.reasonLabels[r.reason] ?? r.reason)
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <form action={action}>
        <input type="hidden" name="csv" value={csv} />
        <button
          type="submit"
          disabled={!canImport}
          className="self-start rounded bg-accent px-4 py-2 font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {canImport ? labels.importButton : labels.nothingToImport}
        </button>
      </form>
    </div>
  );
}
