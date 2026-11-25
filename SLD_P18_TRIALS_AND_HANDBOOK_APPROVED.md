# SLD P18 — Prospect trial access, platform handbook and video scripts: founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-25. **Replaces the public sandbox plan.** `SLD_P18_SANDBOX_AUSTRIA_APPROVED.md` is **parked**: don't implement it. `SLD_SANDBOX_READINESS_RULES.md` stays a standing rule, so a public sandbox remains possible later. No legal-content gate. Same engineering rules as always (registry, shell + primitives, hand-written migrations, enum-first, RLS + non-owner role, `Restrict` FKs, append-only history, `AuditEvent`, DE/EN/RO, tests green per commit, slices with commit + push).

**Sales approach this supports:**
1. The founder presents live in the **demo tenant** (exists: seed, one user per role, demo script, reset).
2. Prospects get the **handbook** and short **videos**.
3. After a good call, a prospect gets **personal trial access**: their own copy of the demo company with a normal login and a time limit.

---

## Part A — Prospect trial access

### A.1 Model
- `Company.tenantKind`: `CUSTOMER` | `DEMO` | `TRIAL` (enum-first; the existing demo company becomes `DEMO`, all others `CUSTOMER`).
- For `TRIAL`: `trialExpiresAt`, `trialContactEmail`, `trialCreatedByUserId`, `trialConvertedAt` (nullable), `trialNotes` (founder-only).
- Trial tenants are **excluded** from customer counts, platform-wide statistics and any future billing logic.

### A.2 Creating a trial (`/admin` → Testzugänge → "Testzugang anlegen", super_admin only)
- **Fields:**
  - prospect company name;
  - contact person's email (becomes the trial's first Administrator);
  - country of the sites: AT or DE (CH stays off);
  - duration (default **30 days**);
  - starting data:
    - **"Mit Demo-Daten"** (default): `seed:prospect` applied with the prospect's company name, fictional sites, people and products, dates relative to today;
    - **"Leer"**: an empty company that starts in the onboarding wizard (P13).
- **Modules:** all entitled by default; adjustable afterwards in the existing module matrix (P13). Chemistry engines on `PREVIEW`.
- On creation, the existing invite flow emails the contact. The email names the trial end date and links to the trial terms (A.6).
- The trial admin can invite colleagues with any tenant role (P17), up to **10 users per trial** (env, default 10).

### A.3 Inside a trial tenant
- **Top band:** "Testzugang bis TT.MM.JJJJ · Fragen? Kontakt aufnehmen". The contact link opens an email to the founder.
- **Data note** in the band and the onboarding: "Für den Test empfehlen wir Beispieldaten. Wenn Sie echte Personendaten eingeben, gilt die Auftragsverarbeitungsvereinbarung (Vorlage)."
- **AI caps** lower than for customers (default 25 SDS extractions and 50 drafts per trial); manual entry always works.
- Everything else is the real production app: real emails, real PDFs, all roles.

### A.4 Lifecycle
- **Reminders by email** to the trial admin, with a copy to the founder (`TRIAL_NOTIFY_EMAIL`): 7 days and 2 days before expiry.
- **At expiry:** the trial is **locked** (sign-in shows a page: "Ihr Testzugang ist abgelaufen" plus contact). Data is kept for a **30-day grace period**.
- **After the grace period:** all tenant data and uploads are deleted via the P13 deletion path, audited. A job runs daily and **proposes** deletions in `/admin`; the founder approves (same principle as retention batches). An optional auto-approve setting stays off by default.
- **Founder actions in `/admin`:**
  - **Verlängern** (extend);
  - **Zurücksetzen** (re-apply the seed, only for "Mit Demo-Daten" trials);
  - **In Kunde umwandeln** (`tenantKind → CUSTOMER`, expiry removed, data kept, band removed, normal AI caps);
  - **Löschen** (double confirm).

  Every action is audited.

### A.5 Founder overview (`/admin` → Testzugänge)
- List: company, contact, country, created, expires, status (aktiv / läuft bald ab / gesperrt / umgewandelt), users invited, last activity, modules used (per tenant, aggregated: visits per module, no per-user tracking), SDS uploads and AI usage.
- A **new trial sign-in** sends an email to the founder (first login of the trial admin).

### A.6 Templates (marked `TEMPLATE — needs legal review`)
- **Testnutzungsbedingungen** (trial terms): free, time-limited, no warranty, preview calculations aren't advice, data deleted after expiry plus grace unless converted, and the founder may see aggregated usage to support the trial.
- The **AVV/DPA template** (P13 §7) is referenced for trials with real personal data.

---

## Part B — Platform handbook (Benutzerhandbuch)

### B.1 Format and single source
- Markdown in the repo: `docs/handbuch/de/` (German first, de-AT terms with DE equivalents noted). The structure allows `en/` later.
- **Rendered in the app** under **Hilfe** (sidebar, pinned bottom; P2 already reserved it):
  - table of contents filtered by the reader's role;
  - search;
  - deep links from each module page ("Hilfe zu diesem Modul").
- **PDF export:** the full handbook, and one PDF per role, generated from the same source with a cover, version and date. These are the files the founder sends to prospects.
- **Screenshots generated automatically:** a script `npm run docs:screenshots` signs into the demo tenant as each role (de-AT, light theme, fixed viewport) and captures the routes listed in a manifest, overwriting `docs/handbuch/img/`. After UI changes, the screenshots are regenerated in one command.
- **Checks:**
  - every app route linked from the handbook exists;
  - every image referenced exists;
  - every legal reference in the text comes from the verified catalogue (no new legal statements in the handbook);
  - runs in CI.

### B.2 Structure
- **Teil 1 — Grundlagen:** sign-in (incl. access code), navigation and sidebar, site switcher, Meine Aufgaben, notifications, activity calendar, languages, help.
- **Teil 2 — Module**, one chapter each: Cockpit; Gefährdungsbeurteilung / Evaluierung; Begehungen & Audits; Ereignisse (incl. statutory deadlines); Umwelt; Maßnahmen; Gefahrstoffe (incl. SDS extraction, checks, Betriebsanweisungen, storage, preview engines); Unterweisungen; Personen; Rechtskataster; Dokumente; Auswertungen; Sicherheitsinformationen (if built).

  Each chapter covers:
  - purpose and who uses it;
  - main workflows step by step with screenshots;
  - statuses and what they mean;
  - outputs (PDFs, exports);
  - legal background (references from the catalogue, no advice);
  - tips and frequently asked questions.
- **Teil 3 — Rollen:** "Ihr Arbeitsalltag als …" for Administrator, Standortadministrator, EHS-Fachkraft, Führungskraft and Mitarbeitende, each with a short task list and links into Teil 2.
- **Teil 4 — Administration:** organisation and sites, users and roles (incl. company-editable bundles), catalogues and templates, imports (P14 framework), notification rules, retention and anonymisation, employee accounts.
- **Teil 5 — Datenschutz & Sicherheit:** the person-free assessment principle, the people and health compartments, roles and audit, retention, hosting. A plain-language summary of the TOMs.
- **Glossar:** AT/DE terms side by side (Evaluierung / Gefährdungsbeurteilung, SFK / Sifa, SGD / GBU-Dokumentation …).
- **Internal only (not rendered for tenants, not in PDFs):** a super-admin chapter (tenants, modules, catalogues, trials, flags).

### B.3 Writing rules
- Written from the actual UI and code, not from plans. CC walks each workflow in the demo tenant before writing it.
- Plain German, second person formal ("Sie"), short steps, one screenshot per key step.
- No claims beyond what the app does. Preview features are labelled as preview.

### B.4 Produktüberblick (sales document)
A short PDF of about **10 pages** derived from the handbook:
- the problem SLD solves;
- the modules in one page each, with one screenshot;
- roles;
- AT/DE legal coverage (from the catalogue, honest gaps named);
- data protection;
- how a trial works.

German, generated from markdown like the handbook.

---

## Part C — Video scripts (founder records)

- `docs/videos/DE_SKRIPTE.md`: one script per video. Each has its length, the demo-tenant role to use, the exact click path, the German voice-over text, and what to show on screen. Reset the demo tenant before each recording.
- Videos (2–3 min each, the overview 3–4 min):
  1. Überblick: SLD in 3 Minuten
  2. Arbeitsplatzevaluierung / Gefährdungsbeurteilung
  3. Begehungen & Audits
  4. Ereignisse und gesetzliche Meldefristen
  5. Maßnahmen und Aktivitätenkalender
  6. Gefahrstoffe: SDB einlesen und prüfen
  7. Unterweisungen aus Sicht der Führungskraft
  8. Rechtskataster
  9. Auswertungen und Kennzahlen
  10. Rollen und Zugang für Mitarbeitende
- **Optional raw footage:** a script `npm run docs:videos` plays each click path automatically in the demo tenant (Playwright) and records silent screen videos at 1080p. The founder adds the voice-over, or records live using them as a rehearsal.

---

## Build order (slices, commit + push after each, tests green)
1. `tenantKind`, trial fields, exclusion from customer statistics (A.1).
2. `/admin` trial creation with seed choice, invites, user limit, trial band, AI caps (A.2–A.3).
3. Lifecycle: reminders, lock, grace, deletion proposals, extend / reset / convert / delete, founder overview and notifications (A.4–A.5).
4. Trial terms template (A.6).
5. Handbook infrastructure: docs folder, in-app Hilfe renderer with role filter, search and deep links, PDF export, screenshot script, CI checks (B.1).
6. Handbook content: Teil 1–5, glossary, internal super-admin chapter (B.2–B.3).
7. Produktüberblick PDF (B.4).
8. Video scripts and optional automated raw recordings (Part C).
9. **Verify:**
   - Create a trial with demo data for a test company (AT); receive the invite; sign in; invite a colleague; see the band.
   - Fast-forward to the reminders, the lock and the deletion proposal; convert another test trial to a customer.
   - Open Hilfe as each role and see the filtered contents.
   - Export the handbook PDF and one role PDF; run the screenshot script.
   - Confirm all CI checks pass. Update CLAUDE.md status.
