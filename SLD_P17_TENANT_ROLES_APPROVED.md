# SLD P17 — Tenant roles: final role model and permission matrix — founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-14. Refines the role model built in P7b (`RoleAssignment` with scopes COMPANY / SITE / ORG_UNIT / SELF; system role bundles; one scope helper `src/lib/auth/scope.ts`) and applies it to **every module that exists now** (several came after P7b: Gefahrstoffe extensions, Begehungen, Ereignisse, Rechtskataster, Auswertungen, P14/P15/P16). No legal gate. Same engineering rules as always, plus `SLD_SANDBOX_READINESS_RULES.md`.

## 1. The five tenant roles

Internal keys stay as they are (no renaming migration). Only the displayed names change.

| # | Key (unchanged) | Display name DE / EN | Scope | Who |
|---|---|---|---|---|
| 1 | `company_admin` | Administrator / Administrator | COMPANY (all sites) | Company-level admin, head of EHS |
| 2 | `site_admin` | Standortadministrator (EHS-Management) / Site admin (EHS manager) | SITE (one or more) | EHS manager of a site |
| 3 | `ehs_specialist` | EHS-Fachkraft / EHS staff | SITE (one or more) | Safety specialists, environmental staff, EHS coordinators |
| 4 | `manager` | Führungskraft / Leader | ORG_UNIT (one or more, incl. sub-units) | Department, shift and team leaders |
| 5 | `employee` | Mitarbeitende / Employee | SELF | Every other employee with an account |

Unchanged and outside these five:
- `super_admin` and `l3_support` (platform level, `/admin`).
- The special roles from P10 (`occupational_physician`, `works_council`), which keep their own narrow bundles.

**Several roles per user are allowed** (e.g. a leader in department A who is also EHS staff at site X). Effective rights = the union of each role within its own scope. The scope helper already does this; add tests for the overlapping cases.

## 2. Permission matrix (defaults)

Legend: **E** = create/edit · **A** = approve/release · **R** = read · **R⁺** = read limited to own scope as described · — = no access.

| Module / function | Admin | Site admin | EHS staff | Leader (own units) | Employee (self) |
|---|---|---|---|---|---|
| **Cockpit** | R all sites | R own sites | R own sites | R⁺ own units: open actions, training status, open inspection items | — (start page = Meine Aufgaben) |
| **Meine Aufgaben / Aktivitätenkalender** | own items | own items | own items | own items + own units | own items |
| **Stammdaten: org tree, sites** | E | E own sites (below site level) | — | — | — |
| **Stammdaten: workstations, processes** | E | E | E own sites | R own units | — |
| **Users & roles** | E: grant any tenant role | E: grant EHS staff, leader, employee on own sites | — | — | — |
| **Catalogues, templates, notification rules** | E company level | E site level | — | — | — |
| **Gefährdungsbeurteilung** | E, A | E, **A** | E, submit for approval | R approved assessments of own units' workstations | — |
| **Worker briefing / Betriebsanweisungen for own workstation** | R | R | R | R own units | **R for workstations they are assigned to** |
| **Begehungen & Audits** | E | E, plan + perform | E, plan + perform | R own units; take part when added as participant | — |
| **Ereignisse: report** | ✓ | ✓ | ✓ | ✓ | ✓ (plus anonymous QR without login) |
| **Ereignisse: investigate, notify authorities** | E | E | E | R⁺ own units without health data; contribute when assigned | own reports only (status) |
| **Health sub-compartment (P10)** | — by default | — by default | — | — | — |
| **Umwelt** | E | E | E | — | — |
| **Maßnahmen** | E | E, assign, verify | E, assign, verify | update actions they or their units are responsible for; **propose** new actions (status `PROPOSED`, EHS confirms) | update actions assigned to them personally |
| **Gefahrstoffe: register, SDS, storage** | E | E | E | R substances used in own units | — |
| **Gefahrstoffe: engines (P16)** | per flag | per flag | per flag | — | — |
| **Unterweisungen: requirement types (catalogue)** | E company level | E site level | E content | — | — |
| **Unterweisungen: attach requirements to workstations / processes / units** | E | E | E | — | — |
| **Unterweisungen: organise** (plan sessions, invite, record attendance and records, upload session material, send reminders, matrix, due lists, export) | E | E | E | **E own units** | — |
| **Unterweisungen: own status** | ✓ | ✓ | ✓ | ✓ | **R own status and due dates, confirm a received instruction, see invitations** |
| **Personen** | E | E own sites, CSV import | E own sites | R⁺ own units: name, unit, assignment, training status only | R self |
| **Rechtskataster** | E, A | E, A | E (evaluate) | — | — |
| **Dokumente** | E | E | E | R documents linked to own units; E session material | R documents published to them; read confirmations |
| **Auswertungen** | R all | R own sites | R own sites | R⁺ training and action KPIs of own units (minimum group size applies) | — |

**Approval default:** releasing a risk assessment (and the Rechtskataster evaluations) belongs to the **site admin**. A company can extend `A` to EHS staff by editing the role bundle (§3), for small sites without a separate EHS manager.

## 3. Company-editable role bundles, with guardrails

The five bundles above are **system defaults**. A company admin can adjust a copy for the company (P1/P3 design: bundles are data per company), within guardrails enforced in code, not in the UI:
- The health permission (`health_data.read/write`) can **never** be added to the leader, employee or EHS staff bundles. It's only granted to an individual user as an explicit, audited assignment (default: occupational physician).
- Leader and employee bundles can never gain access outside their scope (ORG_UNIT / SELF).
- No bundle can grant platform roles or module entitlement (super-admin only).
- Every bundle change writes an `AuditEvent` and is shown in the super-admin user/role overview.

## 4. Leaders organise training (the main functional gap)

Within their own units (including sub-units), a leader can:
- See the instruction matrix and due lists for their people (required items only, with the "erforderlich wegen …" reason from P7b).
- **Plan a training session:** topic(s) from the requirement types, date, place, trainer (a user or an external name), invited persons from their units; send invitations and reminders by e-mail/in-app.
- **Record attendance** after the session (tablet-friendly list, optional signature on screen), which creates the `TrainingRecord`s.
- Attach session material (documents) and see the generated attendance list / Unterweisungsnachweis PDF.
- Get notified when people in their units become due or overdue.

A leader **can't** change requirement types, attach requirements to workstations, see other units, or see health or incident-health data.

## 5. Accounts for all employees (including people without e-mail)

Production workers in DACH often have no company e-mail. Support both:
- **E-mail invite** (existing flow).
- **Access code without e-mail:** for a `Person` with a personnel number, an admin or site admin generates a one-time access code (printable sheet or handed over). The person signs in with **personnel number + access code**, then sets their own password. The code expires (default 14 days) and works once.
- **Bulk provisioning:** from Personen, select persons and create employee accounts in one step (e-mail invite where an e-mail exists, access-code sheet otherwise).
- **Offboarding:** when a person gets an end date or is deactivated, their account is disabled automatically on that date.
- **Works council:** employee accounts plus confirmation logs are co-determination topics (BetrVG §87(1) Nr. 6 in DE, ArbVG §96a in AT). Extend the works-council information pack template (P13 §7) with a short section on what the employee role can see and what is logged. It remains a template.

Tenant-level setting "Mitarbeitenden-Konten aktivieren" (default off), so a company can start with EHS roles only.

## 6. Demo and sandbox readiness
- The demo seed pack (P16 §5) gets **one fictional user per role** with fictional names and a clear marker. The founder can open any of them via read-only impersonation in `/admin` to show prospects each role's view.
- Role names, invites, access-code sheets and e-mails use the configured base URL (sandbox readiness rules 2 and 8).

## 7. Build order (slices, commit + push after each, tests green)
1. Display names DE/EN/RO; matrix in §2 encoded as the default bundles; scope tests for every module × role × in/out of scope, including overlapping roles.
2. Approval default to site admin, with the bundle option for EHS staff; `PROPOSED` action status for leader proposals.
3. Company-editable bundles with the §3 guardrails and audit.
4. Leader training organisation (§4): session planning, invitations, attendance capture, records, PDFs, due notifications.
5. Employee view: own instructions, Betriebsanweisungen and briefing for assigned workstations, confirmations, own actions, own incident reports.
6. Access-code sign-in, bulk provisioning, automatic offboarding, tenant setting (§5); works-council template section.
7. Demo seed users per role (§6).
8. **Verify:**
   - German HTTP walkthrough on the AT demo site as each of the five roles: the leader plans a session and records attendance; the employee signs in with an access code, sees their due instruction and confirms it; the site admin approves an assessment that EHS staff submitted; the leader can't open another unit.
   - Permission matrix test fully green.
   - Update CLAUDE.md status.
