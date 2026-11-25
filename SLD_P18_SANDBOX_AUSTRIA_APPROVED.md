# SLD P18 — Prospect sandbox at staturalabs.com/sandbox (Austria): founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-25. Builds the sandbox prepared by `SLD_SANDBOX_READINESS_RULES.md` and P16 slice 0 (base path from `BASE_PATH`, scoped cookies, `APP_ENVIRONMENT` resolver, `check:basepath`, prospect seed pack, one demo user per role from P17 slice 7). **Austria only for now.** No legal-content gate. Same engineering rules as always (hand-written migrations, enum-first, RLS + non-owner role, `Restrict` FKs, append-only history, `AuditEvent`, DE/EN/RO, tests green per commit, slices with commit + push).

**State checked 2026-11-25:** code readiness is done. On Vercel there is only the project `staturalabs`; no sandbox deployment or sandbox database exists yet.

---

## 1. Target

A prospect opens `staturalabs.com/sandbox`, starts a demo in under a minute, and gets **their own isolated Austrian demo company** with every module filled with realistic fictional data. They can switch between the five role views, try everything (including uploading their own SDS), and the demo expires automatically. The founder sees who signed up and what they used.

## 2. Infrastructure

**Shape** (from the readiness rules): a second deployment of the same repo, its own database, and the main domain forwarding `/sandbox` to it.

| Step | Who | What |
|---|---|---|
| 1 | **Founder** | Create a new Supabase project in the EU (Frankfurt), e.g. `staturalabs-sandbox`. Add its URL and keys as environment variables in the new Vercel project (step 2). This needs the founder's Supabase account, so CC can't do it. |
| 2 | CC (Vercel CLI), or founder if CLI access is missing | Create the Vercel project `staturalabs-sandbox` from the same Git repo and `main` branch. Env: `BASE_PATH=/sandbox`, `NEXT_PUBLIC_BASE_PATH=/sandbox`, `APP_ENVIRONMENT=sandbox`, `APP_BASE_URL=https://staturalabs.com/sandbox`, the sandbox Supabase variables, the email provider (sandbox sender), and the AI key with sandbox caps. |
| 3 | CC | In the **main** project, add a rewrite `/sandbox/:path*` → the sandbox deployment (`https://<sandbox-project>.vercel.app/sandbox/:path*`), driven by an env var `SANDBOX_ORIGIN`. If it's unset, `/sandbox` returns 404. Check assets, API routes, auth callbacks and server actions all work through the rewrite. |
| 4 | CC | Apply all migrations to the sandbox database, set up the RLS/non-owner role there as in production (P13), and provision the founder as `super_admin` in the sandbox (`scripts/provision-super-admin.mjs`). |
| 5 | CC | Supabase Auth in the sandbox: site URL and redirect URLs set to `https://staturalabs.com/sandbox/...`. |
| 6 | CC | CI: each push to `main` deploys both projects; the `check:basepath` build stays mandatory. Production and sandbox share no database, storage bucket, cron job or queue (readiness rules 3 and 7). |

If step 1 isn't done when CC starts, CC builds and tests everything against a local/preview database and stops before step 4 with a one-line note listing exactly which variables are missing.

## 3. Austria only

- `SANDBOX_COUNTRIES=AT` (env, list). In the sandbox, new sites can only be Austrian, and the seed creates AT sites only. DE and CH content stays in the code but can't be selected there.
- All demo content uses Austrian terminology, de-AT, Austrian legal references (verified rows only) and the AT documents (SGD, AWK, AUVA-Unfallmeldung export, Arbeitsstoffliste).

## 4. How prospects get in

- **Start page** `staturalabs.com/sandbox`: short German page ("SLD testen — Ihre eigene Demo-Firma in einer Minute"), a form (business email, name, company, optional phone), a checkbox for the demo terms, and a separate, optional consent checkbox for follow-up contact.
- **Signup modes** (env `SANDBOX_SIGNUP_MODE`):
  - `open` (default): self-serve with email verification.
  - `invite`: only links the founder generates in `/admin` work. This is useful if abuse appears.
- After verification, CC's provisioning:
  1. creates a new tenant `tenantKind = PROSPECT`;
  2. applies `seed:prospect` (Austrian version, §6);
  3. sets the expiry (default 14 days);
  4. signs the prospect in as the demo company's **Administrator**.
- **Abuse protection:** rate limits on signup by IP and by email domain, verification required before any tenant is created, a maximum number of active prospect tenants (env, default 200), and optional CAPTCHA via env (off by default; Cloudflare Turnstile if switched on).
- The marketing site (`staturalabs.com`) gets a "Demo testen" button linking to `/sandbox`.

## 5. Inside a prospect tenant

- **Permanent top band:** "Demo-Umgebung — Ihre Demo läuft bis TT.MM.JJJJ. Bitte keine echten Personendaten eingeben." Plus a link "Kontakt aufnehmen" (to the founder).
- **Role switcher (sandbox only):** a control in the top band to view the app as each of the five roles (Administrator, Standortadministrator, EHS-Fachkraft, Führungskraft, Mitarbeitende). It uses the seeded fictional user per role (P17 slice 7) and switches within the prospect's own tenant only. It never exists in production; enforce this with a test.
- **Everything is on:** all modules entitled, and all six chemistry engines on `PREVIEW` (resolver branch already exists).
- **AI features** (SDS extraction, hint explanations, Betriebsanweisung drafts) are on, with a low per-tenant cap (default 10 SDS extractions and 20 drafts per demo). When the cap is reached, a friendly note appears and manual entry keeps working.
- **Emails:** only sent to the prospect's own verified address and marked "[Demo]". Notifications to fictional users are shown in-app only and never emailed (readiness rule 8).
- **Employee accounts / access codes:** demonstrable with the fictional users; real code redemption is limited to the prospect's own tenant.
- **Uploads:** the prospect may upload their own SDS and documents. The upload dialog says they're deleted at expiry.
- **Guided path:** a small "Demo-Highlights" checklist in the sidebar, which can be closed. It has 8 steps that deep-link into the seeded data, following the existing demo script and extending it to all modules:
  1. risk assessment of a workstation;
  2. an inspection with an open action;
  3. an accident with the AUVA deadline;
  4. the training matrix and a leader planning a session;
  5. SDS upload and comparison;
  6. the TRGS 510 / VbF view;
  7. the legal register;
  8. reports and a safety broadcast.

  Each step ticks off when visited.

## 6. Austrian prospect seed

Extend `seed:prospect` so the Austrian demo company feels lived-in across **every** module. Fictional company, people and products only; real substances and real Austrian legal references are fine.
- **Company and sites:** 2 AT sites (e.g. a production plant and a warehouse), an org tree, about 15 workstations and processes, and about 40 fictional persons with assignments.
- **Risk:** approved and draft assessments, findings in several hazard categories, ergonomics, exposure data, and a generated SGD.
- **Begehungen:** templates, completed and planned inspections, observations.
- **Ereignisse:** an accident with a running AUVA deadline, near misses (one anonymous), first-aid entries, one closed investigation with actions.
- **Umwelt:** aspects, waste streams with quantities, an AWK.
- **Maßnahmen:** open, overdue and verified actions from different sources.
- **Gefahrstoffe:** the P16 products with their deliberate supplier errors, storage locations, Betriebsanweisungen.
- **Unterweisungen:** requirements, a matrix with every status, a planned session.
- **Rechtskataster:** applicable requirements with evaluations.
- **Dokumente:** a library and archived generated documents.
- **Auswertungen:** 18 months of history including workforce hours, so rates and trends show real curves.
- **Broadcasts:** the three demo broadcasts, if that feature is built.

The seed's dates are relative to the provisioning date, so deadlines and "overdue" always look current. Provisioning a tenant must finish in under 30 seconds; if seeding is slower, pre-build a pool of ready tenants (default 5) that are assigned at signup and refilled in the background.

## 7. Lifecycle and cleanup

- **Expiry:**
  - Day 11: email "Ihre Demo läuft in 3 Tagen ab" with a contact link.
  - Day 14: the tenant is locked and shows a page with contact options.
  - Day 14 + 7: all tenant data (including uploads) is deleted via the P13 deletion path, audited. Only the lead record (§8) stays, and only if the prospect consented to follow-up.
- The founder can extend, reset (`reset:prospect`) or delete a prospect tenant in `/admin`.
- All jobs run only in the sandbox environment and never touch production (readiness rule 7).

## 8. For the founder

- **`/admin` → Prospects:** list of prospect tenants with name, company, email, signup date, expiry, last activity, modules and highlight steps visited, SDS uploads and AI usage. Actions: extend, reset, delete, open read-only (impersonation as in P13).
- **Email to the founder** on every new verified signup (env `SANDBOX_NOTIFY_EMAIL`).
- **Activity tracking:** page/module visits per prospect tenant (no third-party analytics), disclosed in the sandbox privacy notice. It's used only to see which modules interest a prospect.
- Export of consented leads (CSV).

## 9. Legal texts (templates, marked `TEMPLATE — needs legal review`)
- **Demo terms (Nutzungsbedingungen Demo):** no warranty, no real personal data, preview calculations aren't advice, data deleted at expiry.
- **Privacy notice for the sandbox:** what's collected at signup (email, name, company, phone), purpose, legal basis (performing the demo; separate consent for follow-up contact), retention (deleted with the tenant, consented leads kept until revoked), processors (Supabase, Vercel, email provider, Anthropic for SDS extraction), and the right to deletion.
- Both are linked from the start page and the top band.

## 10. Build order (slices, commit + push after each, tests green)
1. Infrastructure (§2): sandbox project, rewrite, migrations, auth URLs, CI for both projects. Stop with a precise note if the founder's Supabase step is missing.
2. `SANDBOX_COUNTRIES`, `tenantKind = PROSPECT`, expiry fields, sandbox top band, email rules (§3, §5).
3. Start page, signup, verification, provisioning (+ tenant pool if needed), abuse protection, signup modes (§4).
4. Role switcher (sandbox-only, with the production test), AI caps, guided highlights (§5).
5. Austrian prospect seed across all modules with relative dates (§6).
6. Lifecycle jobs: reminder, lock, deletion (§7).
7. `/admin` Prospects view, founder notification, activity tracking, lead export (§8).
8. Legal templates and links (§9); "Demo testen" button on the marketing site.
9. **Verify on the live URL `https://staturalabs.com/sandbox`:**
   - Sign up with a test address, verify, land in a seeded Austrian company within 30 s.
   - Walk all 8 highlights in German, switch through all five roles, upload an SDS.
   - Confirm production shows no sandbox elements and no role switcher.
   - Fast-forward expiry on a test tenant (lock, then delete).
   - Confirm the founder email and the Prospects view.
   - Update CLAUDE.md status.
