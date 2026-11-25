"use client";

import { useState } from "react";

// P17 §5: bulk provisioning + the printable access-code hand-over sheet.
//
// A client component (and a POST route rather than a Server Action) for one
// reason: the one-time codes are shown ONCE and only their hash is stored, so
// the response has to be rendered in place. Nothing is persisted here and the
// codes are never put in a URL.

export type AccountStatus =
  | "none"
  | "code-pending"
  | "email-invited"
  | "active"
  | "disabled";

export type ProvisionablePerson = {
  id: string;
  name: string;
  personnelNumber: string | null;
  email: string | null;
  status: AccountStatus;
};

type Outcome =
  | { personId: string; kind: "invite"; email: string }
  | {
      personId: string;
      kind: "access-code";
      code: string;
      codeFormatted: string;
      personnelNumber: string;
      expiresAt: string;
      signInUrl: string | null;
    }
  | { personId: string; kind: "skipped"; reason: string };

export type ProvisioningDict = {
  colSelect: string;
  colName: string;
  colPersonnelNumber: string;
  colEmail: string;
  colAccountStatus: string;
  statusNone: string;
  statusCodePending: string;
  statusEmailInvited: string;
  statusActive: string;
  statusDisabled: string;
  provisionButton: string;
  provisioning: string;
  provisionNoneSelected: string;
  provisionFailed: string;
  accountsDisabledNote: string;
  resultsHeading: string;
  resultInvite: string;
  resultSkipped: string;
  skipReasons: Record<string, string>;
  sheetHeading: string;
  codesOnceWarning: string;
  sheetPersonnelNumber: string;
  sheetCode: string;
  sheetExpires: string;
  sheetUrl: string;
  sheetSteps: string;
  sheetUrlMissing: string;
  printButton: string;
  none: string;
};

export function EmployeeAccountProvisioning({
  siteId,
  people,
  accountsEnabled,
  dict,
  locale,
}: {
  siteId: string;
  people: ProvisionablePerson[];
  accountsEnabled: boolean;
  dict: ProvisioningDict;
  locale: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);

  const nameById = new Map(people.map((p) => [p.id, p.name]));

  const statusLabel: Record<AccountStatus, string> = {
    none: dict.statusNone,
    "code-pending": dict.statusCodePending,
    "email-invited": dict.statusEmailInvited,
    active: dict.statusActive,
    disabled: dict.statusDisabled,
  };

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function provision() {
    setError(null);
    if (selected.size === 0) {
      setError(dict.provisionNoneSelected);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/sites/${siteId}/employee-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds: [...selected] }),
      });
      if (!response.ok) {
        setError(dict.provisionFailed);
        return;
      }
      const body = (await response.json()) as { outcomes: Outcome[] };
      setOutcomes(body.outcomes);
      setSelected(new Set());
    } catch {
      setError(dict.provisionFailed);
    } finally {
      setSubmitting(false);
    }
  }

  const codes = (outcomes ?? []).filter(
    (o): o is Extract<Outcome, { kind: "access-code" }> =>
      o.kind === "access-code",
  );

  return (
    <div className="flex flex-col gap-4">
      {!accountsEnabled && (
        <p className="text-sm text-foreground-muted">
          {dict.accountsDisabledNote}
        </p>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-foreground-muted">
            <th className="py-1 pr-4">{dict.colSelect}</th>
            <th className="py-1 pr-4">{dict.colName}</th>
            <th className="py-1 pr-4">{dict.colPersonnelNumber}</th>
            <th className="py-1 pr-4">{dict.colEmail}</th>
            <th className="py-1 pr-4">{dict.colAccountStatus}</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="py-1.5 pr-4">
                <input
                  type="checkbox"
                  aria-label={p.name}
                  checked={selected.has(p.id)}
                  disabled={!accountsEnabled}
                  onChange={() => toggle(p.id)}
                />
              </td>
              <td className="py-1.5 pr-4 font-medium text-foreground">
                {p.name}
              </td>
              <td className="py-1.5 pr-4 text-foreground-muted">
                {p.personnelNumber ?? dict.none}
              </td>
              <td className="py-1.5 pr-4 text-foreground-muted">
                {p.email ?? dict.none}
              </td>
              <td className="py-1.5 pr-4 text-foreground-muted">
                {statusLabel[p.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="button"
        onClick={provision}
        disabled={submitting || !accountsEnabled}
        className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background disabled:opacity-50"
      >
        {submitting ? dict.provisioning : dict.provisionButton}
      </button>

      {outcomes && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 print:border-0 print:bg-transparent">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold">
              {dict.resultsHeading}
            </h3>
            {codes.length > 0 && (
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded border border-border px-3 py-1 text-xs text-foreground print:hidden"
              >
                {dict.printButton}
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-1 text-sm">
            {outcomes
              .filter((o) => o.kind !== "access-code")
              .map((o) => (
                <li key={o.personId} className="text-foreground-muted">
                  {o.kind === "invite"
                    ? dict.resultInvite
                        .replace(
                          "{name}",
                          nameById.get(o.personId) ?? o.personId,
                        )
                        .replace("{email}", o.email)
                    : dict.resultSkipped
                        .replace(
                          "{name}",
                          nameById.get(o.personId) ?? o.personId,
                        )
                        .replace(
                          "{reason}",
                          dict.skipReasons[o.reason] ?? o.reason,
                        )}
                </li>
              ))}
          </ul>

          {codes.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="font-heading text-sm font-bold">
                {dict.sheetHeading}
              </h4>
              <p className="text-xs text-coral print:text-black">
                {dict.codesOnceWarning}
              </p>
              {codes.map((o) => (
                <div
                  key={o.personId}
                  className="break-inside-avoid rounded border border-border p-3 text-sm"
                >
                  <p className="font-medium text-foreground">
                    {nameById.get(o.personId) ?? o.personId}
                  </p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <dt className="text-foreground-muted">
                      {dict.sheetPersonnelNumber}
                    </dt>
                    <dd className="font-technical">{o.personnelNumber}</dd>
                    <dt className="text-foreground-muted">{dict.sheetCode}</dt>
                    <dd className="font-technical text-base tracking-widest">
                      {o.codeFormatted}
                    </dd>
                    <dt className="text-foreground-muted">
                      {dict.sheetExpires}
                    </dt>
                    <dd>{new Date(o.expiresAt).toLocaleDateString(locale)}</dd>
                    <dt className="text-foreground-muted">{dict.sheetUrl}</dt>
                    <dd>{o.signInUrl ?? dict.sheetUrlMissing}</dd>
                  </dl>
                  <p className="mt-2 text-xs text-foreground-muted">
                    {dict.sheetSteps}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
