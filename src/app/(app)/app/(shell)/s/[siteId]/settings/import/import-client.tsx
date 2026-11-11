"use client";

import { useState, useTransition } from "react";
import type { ImportEntityKey } from "@/lib/import/registry";
import { type PreviewResult, previewImport, runImport } from "./actions";

type ImportDict = {
  heading: string;
  intro: string;
  entityLabel: string;
  templateLink: string;
  pasteLabel: string;
  fileLabel: string;
  previewButton: string;
  commitButton: string;
  previewing: string;
  committing: string;
  summaryCreate: string;
  summaryUpdate: string;
  summarySkip: string;
  summaryError: string;
  colRow: string;
  colStatus: string;
  colDetail: string;
  committedMsg: string;
  noRows: string;
  statusLabels: Record<string, string>;
  reasonLabels: Record<string, string>;
  entityLabels: Record<string, string>;
};

export function ImportClient({
  siteId,
  entities,
  dict,
}: {
  siteId: string;
  entities: ImportEntityKey[];
  dict: ImportDict;
}) {
  const [entity, setEntity] = useState<ImportEntityKey>(entities[0]);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [committed, setCommitted] = useState<{
    committed: number;
    errors: number;
    skipped: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setPreview(null);
    setCommitted(null);
  };

  const onPreview = () => {
    setCommitted(null);
    startTransition(async () => {
      setPreview(await previewImport(siteId, entity, csv));
    });
  };
  const onCommit = () => {
    startTransition(async () => {
      const res = await runImport(siteId, entity, csv);
      setCommitted(res);
      setPreview(await previewImport(siteId, entity, csv));
    });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then((t) => {
      setCsv(t);
      reset();
    });
  };

  const commitable =
    preview && preview.summary.create + preview.summary.update > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {dict.entityLabel}
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as ImportEntityKey);
              reset();
            }}
            className="rounded border border-border bg-background px-2 py-1.5"
          >
            {entities.map((e) => (
              <option key={e} value={e}>
                {dict.entityLabels[e]}
              </option>
            ))}
          </select>
        </label>
        <a
          href={`/api/sites/${siteId}/import/${entity}/template`}
          className="rounded border border-border px-3 py-1.5 text-sm text-accent hover:border-accent"
        >
          {dict.templateLink}
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="import-file" className="text-sm text-foreground-muted">
          {dict.fileLabel}
        </label>
        <input
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="import-csv" className="text-sm text-foreground-muted">
          {dict.pasteLabel}
        </label>
        <textarea
          id="import-csv"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            reset();
          }}
          rows={6}
          className="w-full rounded border border-border bg-background px-2 py-1.5 font-technical text-xs"
          spellCheck={false}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={pending || csv.trim().length === 0}
          className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised disabled:opacity-50"
        >
          {pending ? dict.previewing : dict.previewButton}
        </button>
        {commitable ? (
          <button
            type="button"
            onClick={onCommit}
            disabled={pending}
            className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {pending ? dict.committing : dict.commitButton}
          </button>
        ) : null}
      </div>

      {committed ? (
        <p className="rounded-[var(--radius-md)] border border-status-low/40 bg-status-low/10 px-3 py-2 text-sm text-foreground">
          {dict.committedMsg
            .replace("{committed}", String(committed.committed))
            .replace("{skipped}", String(committed.skipped))
            .replace("{errors}", String(committed.errors))}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 text-xs text-foreground-muted">
            <span>
              {dict.summaryCreate}: {preview.summary.create}
            </span>
            <span>
              {dict.summaryUpdate}: {preview.summary.update}
            </span>
            <span>
              {dict.summarySkip}: {preview.summary.skip}
            </span>
            <span
              className={preview.summary.error > 0 ? "text-status-high" : ""}
            >
              {dict.summaryError}: {preview.summary.error}
            </span>
          </div>
          {preview.rows.length === 0 ? (
            <p className="text-sm text-foreground-subtle">{dict.noRows}</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-foreground-muted">
                  <th className="py-1 pr-3">{dict.colRow}</th>
                  <th className="py-1 pr-3">{dict.colStatus}</th>
                  <th className="py-1 pr-3">{dict.colDetail}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr
                    key={r.rowNumber}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1 pr-3 text-foreground-subtle">
                      {r.rowNumber}
                    </td>
                    <td className="py-1 pr-3">
                      <span
                        className={
                          r.status === "error"
                            ? "text-status-high"
                            : r.status === "skip"
                              ? "text-foreground-subtle"
                              : "text-status-low"
                        }
                      >
                        {dict.statusLabels[r.status] ?? r.status}
                        {r.reason
                          ? ` — ${dict.reasonLabels[r.reason] ?? r.reason}`
                          : ""}
                      </span>
                    </td>
                    <td className="py-1 pr-3 text-foreground">{r.display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
