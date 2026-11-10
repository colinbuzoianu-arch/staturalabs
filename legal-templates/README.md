# Legal pack — templates (P13 §7)

> **TEMPLATE — needs legal review before use. Not binding, not legal advice.**

These are **draft template documents** so the pieces a real deployment and a
customer contract will need already exist in a reviewable shape. They are **not**
executed agreements and **not** legal advice. Qualified counsel must review and
adapt every one before it is used with a customer, a regulator, or a works
council. Binding versions are out of scope until a real deployment.

Operating entity: **Verumsell SRL** (product brand: Statura Labs Dynamics).

Contents:

| File | What it is | Shape |
| --- | --- | --- |
| `AVV-DPA-template.md` | Auftragsverarbeitungsvertrag / Data Processing Agreement skeleton | Art. 28 GDPR / Art. 28 nDSG(CH) |
| `TOMs-template.md` | Technical & organisational measures | Art. 32 GDPR — reflects what the system actually does |
| `subprocessors-template.md` | Sub-processor list | Stub to be completed per deployment |
| `works-council-information-pack-template.md` | Betriebsrat/works-council information pack | Extends the in-app worker-briefing (`/api/sites/[siteId]/worker-briefing`) |

The **worker-briefing** is already generated live, per site, by the app
(`src/lib/report/WorkerBriefingDocument.tsx`). The works-council template here is
the company-level companion to it; its German body still carries a review flag,
as noted in that generator.

The **TOMs** document is the only one whose content is meant to be substantially
accurate today: it states measures the system genuinely implements (RLS, the
people/assessment compartment split, the audit trail, retention batches, EU
hosting, health-field encryption, MFA, the removal of camera capture). It still
needs legal review for completeness and phrasing, but it is not invented.
