# ERGO_COMPLIANCE_BY_DESIGN.md

**Status:** Foundational reference — read before writing schema, pipeline, or scoring code.
**Scope:** Camera-based workplace ergonomics assessment platform. Sold direct to companies, EU-wide (not DACH-only).
**Not legal advice.** This document is engineering orientation derived from publicly available legal sources, compiled to shape architecture decisions early. Formal legal validation is listed as an open prerequisite below and must happen before commercial launch.

---

## 1. Core product framing (non-negotiable)

This platform evaluates **the ergonomic risk of a workstation/task design**. It does not evaluate, monitor, or score an individual worker's performance or behavior.

This framing is not a marketing choice — it is a legal design lever (see §2) and it must be true structurally, not just in copy. If any part of the system ever stores, infers, or outputs something tied to a specific identifiable person, the framing collapses and the legal analysis below no longer applies.

**Test for every feature before building it:** *"Does this describe the job, or does this describe a person?"* If the answer is "a person," stop and re-scope.

---

## 2. Legal foundations (summary)

### 2.1 EU AI Act — Annex III, point 4(b)

High-risk employment AI is defined (in part) as systems used "to monitor and evaluate the **performance and behaviour of persons**" in work relationships. The operative word is *persons*. The workstation/task framing (§1) is a genuine, deliberate design choice, not a marketing gloss — but its legal weight is narrower than it may appear.

**Legal counsel review (July 2026):** external legal counsel confirmed this distinction is "one of the key legal questions" under the AI Act and GDPR, but explicitly advised **against relying primarily on the workstation-not-worker argument** for classification purposes. Per counsel: the European Commission's guidance indicates authorities examine the *actual function and foreseeable use* of a system, not only its formal design intent — meaning that if the system is, in practice, capable of monitoring or evaluating workers in an employment context, it may still fall within Annex III point 4(b) even where human oversight remains part of the decision chain. Treat the workstation-centric architecture as a mitigating factor and a genuine engineering discipline (it materially reduces the actual risk surface, per §3), not as a settled exemption.

**Second review (July 2026), concrete risk vector identified:** counsel independently confirmed the structural separation is real (no worker identifiers, no cross-session tracking, no stored images, no individual profiles, all outputs tied to a workstation) — but flagged a specific way this could still fail in practice: **if a client uses workstation-level scores to indirectly assess a specific worker's performance** — most plausibly where one worker is consistently the sole or primary operator of a given workstation, making the workstation score a de facto proxy for that person — authorities could reasonably treat this as worker monitoring regardless of the system's technical design. This is a client-usage risk, not something the architecture alone can close. Worth keeping in mind for deployment guidance and sales conversations (e.g., multi-operator or rotating workstations present materially lower risk than a workstation permanently tied to one named person), though no specific product mitigation has been prescribed by counsel — noted here as an open consideration, not a mandate.

High-risk obligations under the Act become enforceable **2 August 2026**. Interpretation guidance is still being published as of this writing (July 2026).

**Design consequence:** build as if high-risk from day one (documentation, logging, human oversight — see §3.4, §3.6), regardless of how the final classification lands. Retrofitting is expensive; over-documenting early is not.

**Commercial consequence, non-negotiable:** never state or imply in any commercial, marketing, or sales material that Statura is exempt from, or falls outside, the AI Act's high-risk category, until a formal legal opinion — based on complete technical documentation and current Commission guidance — confirms this. This is counsel's explicit instruction, not a cautious default. See §4 for the corresponding never-build entry.

**Recommended positioning language, per counsel (July 2026):** the credible and legally defensible public/commercial framing is that the product *"was designed from the development phase to meet the relevant requirements of the AI Act and GDPR, with final classification to be confirmed by a formal legal opinion before commercial launch."* Not "outside the AI Act." Not "not classified as high-risk." This framing was checked against the current landing page copy (July 2026) and holds — no revision needed there as of this writing.

### 2.2 GDPR — capture vs. persistence

A camera pointed at a person captures personal data **at the moment of capture**, regardless of what happens to that data afterward. "We don't process personal data" is not an accurate claim if a camera is involved.

The accurate, defensible claim is: **"No identifiable data persists after processing."** This is a claim about storage and identifiability, not about the momentary existence of a video frame in memory. Build for this precise claim — see §3.2 and §3.3.

**Legal counsel review (July 2026):** local/momentary processing without persistence "significantly strengthens" the GDPR position, per counsel, but does not eliminate the need for an Article 6 legal basis — temporary capture of an identifiable individual is still processing. Counsel also flagged an open question not previously resolved in this document: **whether the extracted pose/keypoint data could itself be considered biometric data used for unique identification**, which would trigger Article 9's stricter regime regardless of intended purpose. This depends on technical implementation detail and needs its own technical/legal analysis.

**Second review (July 2026):**

- **Legal basis — do not default to worker consent.** For standard professional deployments, counsel recommends *against* relying on employee consent (Art. 6(1)(a)) as the primary legal basis: the inherent power imbalance in an employment relationship means such consent is rarely considered freely given, per repeated EDPB guidance. The recommended bases for a real client deployment are **Art. 6(1)(c)** (legal obligation, where national law mandates occupational risk assessment) or **Art. 6(1)(f)** (legitimate interest in workplace health and safety) — and this is the *client's* legal basis to establish, not something Statura substitutes for them. Transparency to workers (Art. 13/14 GDPR — clear information about the processing) remains necessary regardless of which Article 6 basis applies; what changes is that consent specifically should not be the relied-upon legal basis for ongoing commercial deployments. The pilot's consent-based approach (§5) was a reasonable basis for a single voluntary, non-commercial technical test with no employment consequence either way — it should not be the template for future client deployments.
- **Article 9 / biometric data — favorable but conditional opinion.** Counsel's view: if keypoints are used exclusively to compute ergonomic angles and do not enable identification or authentication of a person, they likely do **not** constitute biometric data under GDPR. This conclusion is conditional on an explicit technical analysis confirming keypoints as used cannot enable indirect identification — see §5, this is now a concrete, scoped deliverable rather than an open-ended question.

### 2.3 Worker representative involvement — EU baseline + national layers

The AI Act itself introduced an **EU-wide minimum standard**: employers must inform workers and their representatives before deploying a high-risk AI system. This exists across all member states now, not just Germany.

On top of this floor, national co-determination laws often go significantly further and are triggered by a system's *capability* to monitor workers, not just its stated purpose or actual identification:

| Country | Mechanism | Notes |
|---|---|---|
| Germany | Betriebsrat, §87 BetrVG | Co-determination trigger is "suitability to monitor," not intent |
| Austria | Betriebsrat (ArbVG) | Similar co-determination logic |
| Netherlands | Ondernemingsraad, WOR art. 27 | Works council consent required |
| Italy | Statuto dei Lavoratori, art. 4 | Historically strictest; often needs union agreement or labour inspectorate authorization |
| France | CSE | Consultation rights over monitoring tech |

**Design consequence:** design for the strictest common denominator (Germany/Italy-style) as the default posture for every deployment, everywhere in the EU. Do not treat worker-rep consultation as a DACH-specific edge case — bake it into the standard sales/onboarding process for every client, every country.

**Important correction to hold onto:** removing personal data from storage does **not** by itself remove the co-determination trigger in Germany-style law, because the trigger is about a device's *capacity* to monitor a person, which a camera pointed at a person inherently has during capture — independent of what the backend does with the data. Anonymization strengthens the negotiating position; it does not make the conversation with worker reps optional.

---

## 3. Architectural mandates (derived directly from §2)

Each mandate below is a direct consequence of a legal point above, not an arbitrary preference. Status column tracks whether it's locked into the design or still open.

| # | Mandate | Derived from | Status |
|---|---|---|---|
| 3.1 | Workstation/task is the primary entity everywhere in the schema. No `employee_id`, no field that could hold one, anywhere. | §1, §2.1 | Locked |
| 3.2 | No identity-capable processing: no face recognition, no gait recognition, no persistent tracking of the same person across sessions. Keypoints must not be reusable to re-identify anyone. | §2.2, §2.3 | Locked |
| 3.3 | Edge-first by default, not as a premium tier: video frames are processed in memory and discarded immediately. No frame ever touches disk or leaves the local network unless the client explicitly opts into cloud processing for a specific reason. | §2.2, §2.3 | Locked |
| 3.4 | Mandatory human review before any recommendation is acted on. The system outputs findings for a qualified person (ergonomist / EHS manager) to review — never an automated action loop. | §2.1 (Art. 14-style oversight) | Locked |
| 3.5 | Auto-generated worker-representative briefing artifact, produced per deployment: what is captured, what is not stored, what the output is used for. Treat this as a product feature, not paperwork bolted on later. | §2.3 | Built (`GET /api/sites/[siteId]/worker-briefing`) |
| 3.6 | Documentation-first practice: technical documentation, versioned scoring rules, and audit logs maintained as if preparing for a conformity assessment, from the first commit. | §2.1 | Locked |
| 3.7 | Scoring methodology is independently named and built on public standards (ISO 11228, EN 1005) — not marketed as "EAWS," which is a maintained, trained methodology owned by IAD Darmstadt. Full ownership of scoring logic; no third-party licensing dependency. | Business decision, not legal | Locked |
| 3.8 | Scoring rules live as versioned data (DB rows), not hardcoded logic — enables threshold changes and retroactive re-scoring without redeploying, and keeps an audit trail of which rule version produced which score. | Engineering consequence of 3.6 | To build |
| 3.9 | Company/site deletion is DB-level **Restrict**, not Cascade: a `company` or `site` row cannot be deleted while workstations/tasks/scores still reference it underneath. Offboarding a client is a soft `status: archived` flag, never physical deletion. Hard deletion is a separate, deliberate, logged action reserved for retention-period expiry or a valid erasure request — never an accidental side effect of removing a company record. | §3.6, plus likely statutory record-retention obligations independent of this doc | Locked |
| 3.10 | Multi-person handling: if a captured frame contains more than one detected person, the system never silently selects one to score. The operator confirms which detected skeleton is the assessment subject at the moment of capture — a transient UI action, never persisted as an identity. Only the resulting anonymous keypoints/angles for the confirmed skeleton are saved; the frame, any thumbnail, or a record of "who was picked" is not. | §3.2, §3.3, and the same fail-closed pattern already used for ambiguous scoring-rule matches and indeterminate neck facing direction | To build |
| 3.11 | `AssessmentSession.mode` is an explicit enum (`SCHEDULED` \| `CONTINUOUS`), never inferable or defaulted. Scheduled is the current default; continuous is designed for in the schema but implementation-gated behind a feature flag that also requires a documented worker-rep consent artifact per deployment before it can be enabled. The mode is a per-session decision recorded on every session row, so historical data can always be audited for which regime produced which scores. Adding this field now, when the only value is `SCHEDULED`, is cheap; adding it later after continuous exists means an ambiguous data migration. | §5's dual-mode decision, plus §3.6's audit-first posture | To build |
| 3.12 | Risk factors (the process/risk/action register) are recorded at workstation/process/job level only, never per-respondent. `PSYCHOSOCIAL` findings never hold per-respondent data; if survey-based capture is ever built for psychosocial risk, it stores aggregates only, with a documented minimum group size, never an individual response. | §1, §3.1 | To build |
| 3.13 | Action responsibility (`Action.responsibleUserId`) references a `PlatformUser` account or a role label only, never a shop-floor worker identity — the same person/job separation §3.1 draws for the assessment chain applies equally to who a corrective action is assigned to. | §3.1, §2.1 | To build |
| 3.14 | Risk-matrix versions (`RiskMatrixVersion`) follow the same fail-closed, single-active-version contract as `MethodologyVersion` (§3.8): which matrix is current is data, not a code constant, zero-active is a misconfiguration that fails closed, and activation is `super_admin`-only. | §3.8 | To build |

### Tenant & role hierarchy (clarifies §3.1)

```
company (tenant)
 └─ company_admin(s)        — human accounts, scoped to the whole company (all sites)
 └─ site (aka "workplace")  — a physical location/department within the company
      └─ site_admin(s)      — human accounts, scoped to one or more sites via assignment, NOT the whole company
      └─ workstation         — the assessed unit (per §3.1) — never a person, never an account
```

Platform-level roles, above any single company:

- **`super_admin`** — cross-company, full access (founder)
- **`l3_support`** — escalation tier above company admins; reserved for now, currently covered by the founder, structured as its own role so it can be handed to a hired specialist later without a schema change

**Escalation flow:** `site_admin` → `company_admin` → `l3_support` → `super_admin`. Site-level people handle day-to-day findings at their location; company_admin handles cross-site decisions and is the one who escalates upward to L3/the founder.

**`site_admin` scoping uses a join table (`site_assignment`: user + site), not a single FK on the user record** — a person covering multiple sites within one company is a realistic case, and a join table absorbs that without a schema change later. `company_admin` needs no such join: their scope is implicitly every site under their `company_id`.

**The distinction that matters:** `company_admin` and `site_admin` accounts belong to people at the client (EHS managers, HR staff, site coordinators) who *use* the platform, and having a name/email on those accounts is completely fine — they're platform users, not the subject of an assessment. `workstation` records must never carry any of that. The moment a "who is logged in" concept and a "who got scored" concept touch the same table, §1's core framing collapses. Keep them structurally incapable of merging, not just conventionally separate.

---

## 4. Data model non-negotiables ("never build" list)

- Never add a field that stores or references a specific worker's identity, employee number, or name anywhere near posture/scoring data.
- Never store raw video frames, even temporarily, even for debugging. Debug with synthetic/consented test footage only, in a separate non-production environment.
- Never implement cross-session re-identification of the same physical person, even for "continuity of care" style features. If longitudinal tracking is needed, it tracks the workstation, not the person occupying it.
- Never let the scoring engine trigger an automated consequence (alerts to a manager naming a person, automatic task reassignment, etc.). Output is always a recommendation for human review.
- Never treat worker-representative consultation as optional or DACH-only in the sales process, regardless of what country the deployment is in.
- Never analyze, extract from, or reference Aumovio/BDS proprietary materials — software, executables, help documentation, localization files, configs, logs — when designing or building any part of Statura. The founder's own professional domain expertise is fine to draw on; the employer's actual software package is not, regardless of whether anything is literally copied.
- Never state or imply, in commercial, marketing, or sales material, that Statura is exempt from or falls outside the AI Act's high-risk category — until a formal legal opinion confirms this. Explicit legal counsel instruction (§2.1), not a cautious default.
- Never store or infer a per-respondent psychosocial score. `PSYCHOSOCIAL` findings and any future survey-based capture live at workstation/process/job level only, with a documented minimum group size for any aggregate — never an individual response (§3.12).
- Never assign action responsibility to a worker identity. `Action.responsibleUserId` references a `PlatformUser` account only; where the owner is a function rather than a person, use a role label, never a name (§3.13).
- Never let a tenant activate or change the active `MethodologyVersion` or `RiskMatrixVersion`. Activation is `super_admin`-only, matching the same fail-closed, single-active-version contract as scoring rules (§3.14).

---

## 5. Open prerequisites — resolve before or during early build

These are not yet closed. Track them explicitly; do not let architecture quietly assume an answer to one of these.

- [ ] **Formal legal opinion** on AI Act Annex III classification (workstation-framing argument) and GDPR lawful basis for momentary camera processing. **Status (July 2026): two rounds of informal review completed** by external counsel — see §2.1/§2.2 for findings. Key outcomes: workstation-framing confirmed as real but not sufficient alone; a specific client-misuse risk vector identified (single-operator workstations as a de facto worker proxy); legal basis guidance shifted from consent to Art. 6(1)(c)/(f) for real deployments; Art. 9 biometric-data question has a favorable but conditional opinion pending the technical memo below. Still not a *formal* legal opinion in the sense counsel means for pre-commercial-launch positioning — that remains the next step once complete technical documentation is finalized.
- [ ] **Technical memo: keypoint non-identifiability, for Article 9 closure** — counsel's favorable Article 9 read is conditional on an explicit technical analysis confirming pose keypoints as used cannot enable indirect identification of an individual (even incidentally, e.g. via gait or body-proportion patterns across sessions). This is now a scoped, concrete deliverable, not an open-ended question: document what the system does and does not do with keypoints (no cross-session storage tied to a person, no comparison/matching logic, no persistence beyond a single `PostureSample`) and hand it to counsel alongside this document.
- [ ] **Legal basis transition for real deployments** — worker consent (used for the pilot, §5 below) is not the recommended legal basis going forward per counsel. Future client engagements need the client's own Art. 6(1)(c) or 6(1)(f) basis established, with Statura providing supporting technical documentation rather than a worker consent flow as the primary mechanism. Worker-facing transparency information remains necessary regardless of which basis applies — the pilot consent form's informational content isn't wasted, just not the ongoing legal-basis mechanism.
- [ ] **Article 9 / biometric data question** — favorable but conditional legal opinion received (see above); closes once the technical memo is delivered to counsel and confirmed.
- [ ] **Pilot documentation stack, per counsel's recommendation (July 2026), confirmed a second time.** Counsel's second review, having now seen that the field pilot already took place, explicitly named the gap: Pilot Agreement, DPA (if Verumsell is acting as processor), and DPIA "were not implemented before it took place," with retroactive completion recommended and full completion treated as mandatory for any future project. Full recommended stack: Pilot Agreement (scope/responsibilities), DPA where applicable, a documented GDPR assessment (a full DPIA if the risk analysis warrants it), complete worker information, a document on employee-representative consultation, and a technical document on security measures and architecture (this document serves that role). **Status against the completed field pilot:** worker consent form — done, used. Everything else — not in place before the pilot; close retroactively where still meaningful, and treat as a hard prerequisite (not a nice-to-have) before any second pilot or expanded engagement, with this site or any other.
- [x] **MediaPipe accuracy test in real industrial conditions — informally validated (July 2026).** Founder-run test, single-person, not expert-benchmarked: indoor/outdoor lighting — no degradation observed; distance up to 15m — no degradation observed; gloves/occlusion — no degradation observed; partial body blocking — tool correctly reported no detection rather than producing a false reading; real movement (not static poses) — landmarks tracked continuously through motion, angle output roughly 80-90% accurate by informal comparison. This clears the go/no-go question — the core CV premise survives contact with reality — and unblocks the rest of the build. It does **not** replace the validation study below: the 80-90% movement figure was not checked against a calibrated reference (goniometer or similar) or reviewed by anyone with ergonomics expertise, so it's a reliability signal, not an accuracy guarantee suitable for a client-facing claim.
- [x] **Field pilot at a real industrial site — completed (July 2026).** Non-commercial technical pilot, drilling equipment manufacturing hall, arranged via personal contact, 22 workers, consent form used. First real-world test beyond desk-based validation: real work postures under actual task execution (not static test poses), variable industrial lighting, free camera positioning, and — critically — natural multi-person occurrence (coworkers entering frame during real work) with the operator-confirmation selector working correctly on unstaged people for the first time. Results were consistent with the desk-based PoC: accuracy holds across lighting conditions, far-side limb/shoulder visibility limitations reproduce as expected. This is the strongest evidence yet that the desk-based validation generalizes to real deployment conditions, though it remains founder-observed, not expert-benchmarked — the validation study below is still the actual gate for client-facing accuracy claims.
- [x] **Ergonomist / methodology validation partner — resolved as founder self-validation (July 2026).** Founder validates functionality and methodology design directly, drawing on his own occupational-ergonomics-adjacent professional experience (BDS at Aumovio). Sufficient for internal development and functional QA. Independent (non-founder) validation remains a requirement specifically before any client-facing accuracy claim — see Validation study protocol below, which is the actual gate, not this item.
- [ ] **Validation study protocol** — independent (non-founder) comparison of automated angle output vs. a calibrated reference measurement and/or expert manual assessment, on real tasks. Not required for internal development. Required before any client-facing accuracy claim, and before scoring thresholds in §3.8 are sold on rather than just built.
- [x] **Aumovio conflict-of-interest check — resolved by founder (July 2026), standing rule not a one-time resolution.** Employment terms permit working in the same functional area across multiple projects. The line that keeps this resolved: independently-built methodology (§3.7) and founder's own professional expertise are fine to draw on; the employer's actual BDS software, executables, or documentation are never analyzed or referenced for Statura's design, regardless of whether anything is literally copied — see §4.
- [x] **2D single-camera architecture — decided (July 2026).** Statura ships as a single-camera platform. Two synchronized calibrated cameras are not a realistic assumption for real EHS deployments (asymmetric availability, calibration burden, capture-protocol complexity). Where a region cannot be scored reliably from one angle — SHOULDER's unresolvable direction ambiguity, far-side ELBOW/KNEE occlusion in monocular SAGITTAL — the system already reports this explicitly (`WRONG_CAMERA_ANGLE`, `INSUFFICIENT_VISIBILITY`) rather than producing false confidence. This is the honest posture, not a compromise.
- [x] **Continuous monitoring vs. scheduled assessment sessions — decided as dual-mode (July 2026), with hard constraints on the continuous path.** Both modes ship. The user (specifically, a deploying admin per client) selects mode per deployment or per assessment context.

  **Scheduled** is the default and the current implementation: operator-triggered discrete captures, one `PostureSample` per action, session-bounded, high-confidence framing as workstation audit rather than worker monitoring. Everything built to date lands here.

  **Continuous** is the future path for the broader product roadmap discussed (adding workplace safety monitoring, PPE compliance, and other camera-driven modalities alongside ergonomics). It is designed for in the schema now (see `AssessmentSession.mode` below) but implementation is deliberately deferred until: (a) the schema, feature flags, and consent-flow scaffolding are in place, and (b) at least one concrete branch beyond ergonomics has a real deployment reason. This is not a scheduled-mode toggle; it is a distinct operating mode with its own compliance profile.

  **Hard constraints on the continuous mode, non-negotiable from day one:**

  **Legal counsel review (July 2026):** counsel independently and more strongly confirmed this split — describing scheduled and continuous not as "two options of the same product" but as **two different processing models**, and recommending they be treated as **legally and commercially distinct products**, including at the contract level. Scheduled carries clear ergonomic purpose and comparatively simple GDPR justification; continuous approaches worker-monitoring territory, carries materially higher probability of Annex III classification, and adds obligations around transparency, human oversight, employee-representative consultation, and an extended DPIA. Any future continuous-mode contract should be its own agreement, not an addendum to a scheduled-mode contract.

  - The AI Act "workstation not worker" defense is significantly weaker for continuous capture than for scheduled. Any continuous deployment must presume Annex III high-risk classification and be documented accordingly, regardless of framing.
  - Worker representative co-determination for a continuous deployment is not a notification — it is a full negotiated agreement (§2.3). Sales/deployment process must reflect this: continuous mode is not enabled without a documented worker-rep consent artifact per client.
  - No identity data persists in either mode. Every §3.1/§3.2/§3.3 mandate applies to continuous mode identically to scheduled — no exceptions, no "just a thumbnail for audit," no re-identification across frames.
  - Continuous data retention is bounded and minimized. Aggregation windows produce the same anonymous rows the scheduled path does — nothing more granular is stored, and stream data is discarded after aggregation.
  - Safety monitoring modalities (PPE compliance, cobot zone monitoring, etc.) are a different regulatory regime (ISO 10218 / ISO/TS 15066 territory, potentially safety-rated certification requirements). Building them on the same continuous-capture substrate is architecturally fine; treating them as a natural extension of the ergonomics compliance work is not. Each new modality opened on top of continuous mode requires its own compliance assessment before shipping — this is not covered by the ergonomics documentation carrying it forward.
- [x] **Fixed-camera region-of-interest (ROI) cropping — decided (July 2026): per-capture is the mechanism, with an optional saved per-workstation preset.** Restricting processing to a defined sub-region of frame reduces incidental capture of bystanders/neighboring workstations (data-minimization practice, §2.2) and in practice reduces how often §3.10's multi-person case arises. Supporting handheld/phone capture means a per-capture ROI definition must exist regardless of what else is built, so that is the mechanism. Because tripod/USB capture remains equally first-class, a fixed camera may additionally reuse an optional saved per-`Workstation` ROI default, adjustable or clearable at capture time — a preset layered on the per-capture mechanism, not a replacement for it.
- [ ] **INCDPM/Darabont risk-matrix distributability** — is an INCDPM/Darabont-shaped risk matrix (the Romanian de-facto OSH risk-assessment standard) something Statura can distribute to clients, or must each client define/enter their own? §3.7's discipline (independently named methodology, full ownership, no third-party licensing dependency) applies to risk matrices the same way it applies to ergonomic scoring — the seeded `v1-generic-5x5` matrix sidesteps this for now by being generic, but Romanian clients will specifically ask for INCDPM-shaped structure. Needs an explicit decision before a client-specific matrix is built, not an assumption.
- [ ] **Demo capture vs. pilot — hold the line explicitly.** Capturing yourself, or a consenting colleague, for a demo is fine — no frames persist, no identity is stored. Capturing a prospect's workers on their own shop floor is a pilot, not a demo, and triggers the full pilot documentation stack from the item above (Pilot Agreement, DPA, DPIA, worker information, rep consultation). The first pilot happened without most of that stack in place; treat full completion as a hard prerequisite before any second pilot or expanded engagement, with this site or any other. Don't let "just a quick demo on site" quietly become pilot number two.
- [x] **Monocular far-side limb occlusion — resolved as a known limitation, not a threshold-tuning problem (July 2026).** Confirmed via a real capture: in a single-camera SAGITTAL view, the body's far side (elbow/knee/ankle) is partially self-occluded from the camera's perspective — MediaPipe reports low visibility because it's genuinely guessing, not because of poor lighting or framing. No visibility threshold resolves this; it's inherent to one 2D camera viewing one side of a 3D body. Operational consequence: bilateral (`_LEFT`/`_RIGHT`) coverage of these regions in one capture isn't reliable from a single profile view — a second capture from the opposite side is the current workaround if both sides matter for an assessment. Reinforces, rather than resolves, the still-open 2D-vs-stereo item above.
- [ ] **Video/multi-frame capture as a partial mitigation for occlusion — deliberately deferred, not solved.** A longer capture window might catch a moment where a subject's natural movement exposes a currently-occluded side, but only for tasks involving real reorientation — a fixed-orientation task has the same blind spot in every frame regardless of duration. Not a substitute for the stereo decision above. Worth designing together with the holding-time dimension (§ scoring methodology note below) when that phase is taken up, since both require moving from a single instant to a time series — not before.

---

## 6. Recommended build sequencing

1. Resolve the technical validation items in §5 (MediaPipe accuracy, camera setup) with a narrow proof-of-concept — before investing in the full data architecture.
2. Build the data model per §3.1–§3.3 from the start; retrofitting anonymization later is much harder than starting with it.
3. Reuse existing Buzomed infrastructure (auth, multi-tenant, billing) — it's already proven; the genuinely new risk is the CV pipeline + scoring engine, not the SaaS scaffolding.
4. Draft the worker-representative briefing artifact (§3.5) alongside the first pilot deployment, not after.

---

## 7. Sources consulted (for follow-up / legal review)

- EU AI Act, Annex III — https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3
- Commission draft guidelines on high-risk employment AI (DLA Piper summary) — https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/eu-commission-publishes-draft-guidelines-on-high-risk-ai-in-employment
- EU-wide worker representative notification baseline (Lexology) — https://www.lexology.com/library/detail.aspx?g=19b69b8c-4616-47f1-b1fd-a4c77cb790c0
- EAWS methodology background (TU Darmstadt / IAD) — https://www.iad.tu-darmstadt.de/forschung_iad/methoden_iad/eaws_iad.en.jsp

---

*Revision log:*
*v1 — July 2026 — created, based on initial legal-positioning discussion.*
*v1.1 — July 2026 — §5 updated: MediaPipe accuracy item closed (informal PoC), validation study and ergonomist-partner items sharpened accordingly.*
*v1.2 — July 2026 — added tenant & role hierarchy (company / site / workstation, super_admin / l3_support / company_admin) clarifying §3.1.*
*v1.3 — July 2026 — added `site_admin` role (scoped to one or more sites via join table, not the whole company) and escalation flow site_admin → company_admin → l3_support → super_admin.*
*v1.4 — July 2026 — added mandate 3.9: company/site deletion is Restrict not Cascade; offboarding is a soft archive flag, hard deletion is a separate deliberate action.*
*v1.5 — July 2026 — §5 updated: ergonomist-validation item and Aumovio conflict-of-interest item both closed via founder self-resolution; validation study item sharpened to specifically gate client-facing accuracy claims rather than internal development.*
*v1.6 — July 2026 — Aumovio item reclassified as a standing rule rather than a closed one-time resolution, and added as an explicit §4 never-build item, after founder shared actual BDS application files for analysis toward Statura.*
*v1.7 — July 2026 — §5's 2D-vs-stereo item sharpened with a concrete driver: SHOULDER scoring cannot be reliably gated to a single camera angle, since the formula measures elevation magnitude without direction and either camera plane foreshortens one direction of arm-raise.*
*v1.8 — July 2026 — added mandate 3.10: multi-person handling requires operator confirmation of which detected skeleton is the subject, never silently selected, never persisted as identity. Added ROI cropping as an open §5 item, tied to the fixed-vs-handheld camera question.*
*v1.9 — July 2026 — added NECK extension (negative-angle) scoring bands, closing a real gap found via live testing. Closed the far-side-limb-occlusion question as a known limitation (not threshold-tunable), and logged video/multi-frame capture as a deliberately-deferred partial mitigation, to be designed alongside the holding-time dimension later.*
*v1.10 — July 2026 — closed two open §5 items: 2D single-camera architecture confirmed (stereo unrealistic for real deployments), and continuous vs. scheduled monitoring resolved as a dual-mode design with hard constraints on the continuous path (schema field now, implementation gated behind feature flag + documented worker-rep consent per deployment; safety-monitoring modalities on continuous carry their own compliance regime). Added mandate 3.11 for the AssessmentSession.mode enum.*
*v1.11 — July 2026 — recorded the first real field pilot (industrial site, real work postures, natural multi-person occurrence) as a distinct milestone from the earlier desk-based PoC. Results consistent with prior validation; formal expert-benchmarked study remains the actual gate for client-facing accuracy claims.*
*v1.12 — July 2026 — incorporated initial legal counsel review: §2.1 softened from self-assessed "genuine argument" to counsel's explicit caution against relying on the workstation-not-worker distinction alone for AI Act classification; §2.2 updated with the open Article 9/biometric-data question; added a §4 never-build entry prohibiting any "exempt from AI Act" marketing claim before formal opinion; added §5 items for the pilot documentation stack counsel recommends and the retroactive gap against the just-completed field pilot.*
*v1.13 — July 2026 — incorporated second counsel review: §2.1 added the concrete client-misuse risk vector (single-operator workstation as a de facto worker proxy) and confirmed recommended commercial positioning language against current landing page copy; §2.2 added legal-basis guidance (Art. 6(1)(c)/(f) over consent for real deployments) and a conditional-favorable Article 9 opinion; §3.11's scheduled/continuous split strengthened to counsel's explicit "distinct products, distinct contracts" framing; §5 updated with legal opinion progress, a new technical-memo deliverable for Article 9 closure, the legal-basis transition away from consent for future deployments, and a second, more specific confirmation of the pilot documentation gap. Update as remaining open items in §5 close.*
*v1.14 — (reserved — no interim revision recorded between v1.13 and v1.15).*
*v1.15 — July 2026 — added mandates 3.12 (risk factors workstation/process/job-level only, `PSYCHOSOCIAL` never per-respondent), 3.13 (action responsibility is `PlatformUser` or a role label, never a worker identity), 3.14 (risk-matrix versions follow `MethodologyVersion`'s fail-closed, single-active contract, `super_admin`-only activation) — driven by the process/risk/action register introduced in `SLD_IMPLEMENTATION_PLAN_demo-loop.md`. Closed the ROI §5 item: per-capture is the mechanism, with an optional saved per-workstation preset for fixed cameras. Added two new §5 open items: INCDPM/Darabont risk-matrix distributability, and an explicit demo-vs-pilot line so a "quick demo on site" can't quietly become an undocumented second pilot. Added matching §4 never-build entries for 3.12–3.14.*
*v1.16 — July 2026 — mandate 3.5 closed: the worker-representative briefing artifact is built (`GET /api/sites/[siteId]/worker-briefing`, generated per site — "per deployment" in this data model). Content is a direct restatement of already-reviewed claims from §1/§2.1-§2.3/§3.1-§3.4 and the counsel-approved AI Act/GDPR positioning language in §2.1 — no new legal assertion invented for it, no AI Act exemption claim (§4), and it explicitly states it supports the worker-representative consultation process rather than substituting for it (per §2.3's correction that removing personal data doesn't remove the co-determination trigger). English-only for now, a known scope limit given the intended multi-country audience, not an oversight.*
