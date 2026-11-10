# Sub-processor list — template (stub)

> **TEMPLATE — needs legal review before use. Not binding, not legal advice.**
> Complete and keep current per deployment; this is a stub, not an accurate
> current list. Operating entity: Verumsell SRL.

The Processor (Verumsell SRL) engages the following sub-processors to provide the
Statura Labs Dynamics platform. The Controller is informed of intended additions
or replacements and may object (see DPA clause 6).

| Sub-processor | Purpose | Location / region | Transfer mechanism (if outside EU/EEA) |
| --- | --- | --- | --- |
| [Supabase / database & auth provider] | Managed Postgres, authentication, storage | [EU — confirm exact region, e.g. eu-west-1] | [n/a if EU, else SCCs] |
| [Hosting / application platform] | Application hosting / CDN | [confirm region] | [confirm] |
| [Email delivery provider, if used] | Transactional email (invites, notifications) | [confirm] | [confirm] |
| [Error-monitoring provider, if configured] | Error reporting (no person/health data sent) | [confirm] | [confirm] |

**Notes for completion**
- Confirm each provider's actual legal entity, processing location and whether
  any personal data leaves the EU/EEA (or Switzerland for CH customers).
- The error-monitoring seam (`report-error.ts`) is off until a DSN is configured;
  include the provider here only once it is actually enabled, and confirm no
  person or health data is transmitted to it.
- Keep a dated change history so Controllers can be notified of changes.

_Last updated: [date] — **stub, not verified.**_
