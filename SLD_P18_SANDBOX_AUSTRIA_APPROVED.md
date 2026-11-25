# SLD P18 — Public sandbox at staturalabs.com/sandbox (Austria, no login): founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-25 (revised the same day: no login). Builds the sandbox prepared by `SLD_SANDBOX_READINESS_RULES.md` and P16 slice 0 (base path from `BASE_PATH`, scoped cookies, `APP_ENVIRONMENT` resolver, `check:basepath`, prospect seed pack, one demo user per role from P17 slice 7). **Austria only.** No legal-content gate. Same engineering rules as always (hand-written migrations, enum-first, RLS + non-owner role, `Restrict` FKs, append-only history, `AuditEvent`, DE/EN/RO, tests green per commit, slices with commit + push).

**State checked 2026-11-25:** code readiness is done. On Vercel there is only the project `staturalabs`; no sandbox deployment or sandbox database exists yet.

---

## 1. What the founder wants

- **No login, no signup.** Anyone opens `staturalabs.com/sandbox` and is inside the platform.
- **Pre-seeded data:** a complete, realistic Austrian demo company in every module.
- **Each visitor's changes are theirs alone** and are kept while they explore.
- **Then it resets** to the clean demo state.

## 2. How "changes kept only for the visitor" works (decided)

Storing changes literally in the browser (localStorage/IndexedDB) is **not** used: SLD renders pages, PDFs, reports and engine results on the server, so the server would never see browser-only changes, and the whole data layer would have to be rebuilt.

**Instead, use an ephemeral copy per visitor:**
- When a visitor clicks **"Demo starten"**, the sandbox server assigns them **their own temporary demo company** (a ready-seeded tenant from a pool, §5).
- The link between visitor and copy is **only a cookie in their browser** (scoped to `/sandbox`, readiness rule 3). No account, no email, no name.
- Everything they change is stored in their copy on the sandbox server. Nobody else sees it, and the copy has no link to any person.
- **Reset** wipes their copy and gives them a fresh one. A different browser or deleted cookies also means a fresh demo.

Under the hood each visitor is signed in automatically as a seeded fictional user of their own copy (the role they pick, §4), using a server-minted session tied to the cookie. CC chooses the mechanism (e.g. Supabase anonymous sign-in, or an app session) as long as:
- it can never reach another tenant or any production data;
- it never exists when `APP_ENVIRONMENT=production` (enforce with a test).

## 3. Infrastructure

| Step | Who | What |
|---|---|---|
| 1 | **Founder** | Create a Supabase project in the EU (Frankfurt), e.g. `staturalabs-sandbox`, and add its URL and keys as env vars in the sandbox Vercel project. This needs the founder's account. |
| 2 | CC (Vercel CLI), or founder if CLI access is missing | Vercel project `staturalabs-sandbox` from the same repo/`main`. Env: `BASE_PATH=/sandbox`, `NEXT_PUBLIC_BASE_PATH=/sandbox`, `APP_ENVIRONMENT=sandbox`, `APP_BASE_URL=https://staturalabs.com/sandbox`, the sandbox Supabase vars, the AI key with sandbox caps. **No email provider**: the sandbox sends no emails. |
| 3 | CC | In the main project: rewrite `/sandbox/:path*` → the sandbox deployment, driven by `SANDBOX_ORIGIN` (unset → 404). Check that assets, API routes, server actions and PDFs work through the rewrite. |
| 4 | CC | Migrations, RLS and the non-owner role on the sandbox DB (as P13). Founder provisioned as `super_admin` in the sandbox for `/admin` there. |
| 5 | CC | CI deploys both projects from `main`; `check:basepath` stays mandatory. No shared database, storage, cron or queue between the two (readiness rules 3 and 7). |

If step 1 isn't done when CC starts, CC builds and tests everything against a preview/local database and stops before step 4 with a one-line list of the missing variables.

## 4. The visitor experience

- **Entry page `/sandbox`:** short German page ("Statura Labs Dynamics live ausprobieren — ohne Anmeldung"), a role choice (Administrator, Standortadministrator / EHS-Manager, EHS-Fachkraft, Führungskraft, Mitarbeitende; default EHS-Manager), and a **"Demo starten"** button. A copy is assigned **only on this click**, never on page load, so crawlers and bots don't consume copies. App pages under `/sandbox` are `noindex`.
- **Permanent top band** inside the app:
  - "Demo-Umgebung — Ihre Änderungen sind nur für Sie sichtbar und werden zurückgesetzt. Bitte keine echten Personendaten eingeben."
  - A **role switcher** (switch to any of the five role views within the visitor's own copy; sandbox only).
  - A **"Demo zurücksetzen"** button.
  - A "Kontakt aufnehmen" link (§7).
- **Everything is on:** all modules entitled, all six chemistry engines on `PREVIEW`, Austria only (`SANDBOX_COUNTRIES=AT`, so new sites can only be AT).
- **Guided "Demo-Highlights"** checklist in the sidebar, which can be closed. It has 8 deep-linked steps:
  1. a workstation risk assessment;
  2. an inspection with an open action;
  3. an accident with the running AUVA deadline;
  4. the training matrix and a leader planning a session;
  5. SDS upload and comparison;
  6. the TRGS 510 / VbF view;
  7. the legal register;
  8. reports and a safety broadcast.

  Each step ticks off on visit. Progress is stored in the visitor's copy.
- **SDS upload and AI:**
  - The sandbox offers 3–4 ready **demo SDS PDFs** to download and upload, so the extraction can be shown without the visitor's own files.
  - Uploading their own files is allowed with a **cap of 3 AI extractions and 5 AI drafts per copy**, plus a **global daily cap** across all visitors (env, default 200 extractions/day).
  - When a cap is reached, a friendly note appears and manual entry keeps working.
  - Uploaded files are deleted on reset.
- **No emails** are sent from the sandbox. Notifications appear in-app only (readiness rule 8).
- **Employee access codes** and other "invite" flows can be demonstrated, but only within the visitor's own copy and only with the fictional persons.

## 5. Reset rules and copy pool

- **A copy resets when any of these happens:**
  - the visitor clicks "Demo zurücksetzen";
  - **2 hours of inactivity**;
  - **24 hours** after it was assigned.

  All three are env-configurable.
- After a reset the visitor lands on the entry page and can start again immediately.
- Expired copies are **deleted completely** (all data and uploads) by a sandbox-only cleanup job, every 15 minutes, using the leaf-to-root deletion discipline from `reset:demo`. They are never reused with old data.
- **Pool of ready copies** (default 10, env-configurable): seeded in the background so "Demo starten" takes **under 3 seconds**. The pool refills automatically.
- **Hard limit** on simultaneously active copies (env, default 300). Above it, the entry page says "Gerade sehr viele Besucher — bitte in ein paar Minuten erneut versuchen."
- **Rate limit** on "Demo starten" per IP (default 5 per hour).

## 6. Austrian demo seed

Extend `seed:prospect` so the Austrian demo company feels lived-in across **every** module. Fictional company, people and products only; real substances and verified Austrian legal references are fine.
- **Company and sites:** 2 AT sites (a production plant and a warehouse), an org tree, about 15 workstations and processes, and about 40 fictional persons with assignments.
- **Risk:** approved and draft assessments, findings in several hazard categories, ergonomics, exposure data, a generated SGD.
- **Begehungen:** templates, completed and planned inspections, observations.
- **Ereignisse:** an accident with a running AUVA deadline, near misses (one anonymous), first-aid entries, one closed investigation with actions.
- **Umwelt:** aspects, waste streams with quantities, an AWK.
- **Maßnahmen:** open, overdue and verified actions from several sources.
- **Gefahrstoffe:** the P16 products with their deliberate supplier errors, storage locations, Betriebsanweisungen.
- **Unterweisungen:** requirements, a matrix with every status, a planned session.
- **Rechtskataster:** applicable requirements with evaluations.
- **Dokumente:** a library and archived generated documents.
- **Auswertungen:** 18 months of history including workforce hours, so trends and rates show real curves.
- **Broadcasts:** three demo broadcasts, if that feature is built.

**Dates are relative to the moment a copy is assigned**, so deadlines and "overdue" always look current.

## 7. For the founder (anonymous by design)

- **`/admin` → Sandbox** (in the sandbox deployment):
  - number of active copies, pool size, copies started per day, average session length;
  - which modules and highlight steps get visited (aggregated, no per-visitor identity);
  - AI usage against the caps;
  - buttons to refill the pool and to reset everything.
- **Optional contact form** ("Kontakt aufnehmen"): name, company, email, message, with a consent checkbox. It's the **only** place personal data is collected. It sends one email to the founder (env `SANDBOX_CONTACT_EMAIL`, via a minimal transactional mail setting for this form only) and stores the request in a small `SandboxContactRequest` table, deleted after 12 months unless the founder converts it to a lead.
- No third-party analytics. Activity counts come from the app's own data.

## 8. Legal texts (templates, marked `TEMPLATE — needs legal review`)
- **Sandbox notice:** demo only, no warranty, preview calculations aren't advice, no real personal data, changes are deleted on reset.
- **Short privacy notice:**
  - the technically necessary cookie;
  - uploads deleted on reset;
  - processors (Vercel, Supabase, and Anthropic for SDS extraction);
  - the contact form: purpose, legal basis (consent), retention, deletion.
- Both are linked from the entry page and the top band. Because the cookie is technically necessary, no cookie banner is needed; note that in the template for the lawyer to confirm.

## 9. Build order (slices, commit + push after each, tests green)
1. Infrastructure (§3). Stop with a precise note if the founder's Supabase step is missing.
2. Visitor sessions without login: cookie, auto sign-in as a seeded role user of the visitor's copy, isolation tests, and a test that none of it exists in production (§2).
3. Copy pool, assignment on "Demo starten", reset rules, cleanup job, limits and rate limit (§5).
4. Entry page, top band, role switcher, reset button, `SANDBOX_COUNTRIES=AT`, `noindex`, no-email rule (§4).
5. Austrian demo seed across all modules with relative dates (§6).
6. AI caps (per copy and global), demo SDS files, guided highlights (§4).
7. `/admin` Sandbox stats, contact form, privacy/sandbox templates, "Demo testen" button on the marketing site (§7–8).
8. **Verify on the live URL `https://staturalabs.com/sandbox`:**
   - Two different browsers start demos at the same time and can't see each other's changes.
   - Make changes, close the tab, return within 2 hours: the changes are still there. After the reset button they're gone.
   - Walk all 8 highlights in German and switch through all five roles.
   - Hit the AI cap.
   - A bot-like page load creates no copy.
   - Production shows no sandbox elements.
   - Update CLAUDE.md status.
