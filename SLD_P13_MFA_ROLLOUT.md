# P13 §4 — MFA (TOTP) rollout

Status: **built, flag-gated OFF** (`MFA_ENFORCED=false`). Like the RLS rollout,
the code is on `main` and fully exercised at the unit/decision level, but arming
it in production is a deliberate staging step because it depends on a Supabase
project setting and on an interactive flow (QR scan + authenticator app) that
can't be driven headlessly.

## What is built
- **Pure policy** `src/lib/auth/mfa-policy.ts` (unit-tested, 8 cases): which
  roles must use a second factor (`SUPER_ADMIN`, `L3_SUPPORT`, `COMPANY_ADMIN`,
  `EHS_SPECIALIST`, `OCCUPATIONAL_PHYSICIAN` — the high-privilege and health
  roles), and the `ok` / `challenge` / `enroll` decision from role + session AAL
  + whether a verified factor exists.
- **Server gate** `src/lib/auth/mfa.ts` → `mfaRedirectTarget(user)`: reads the
  live Supabase session AAL and factors; fail-closed (any Supabase error ⇒ treat
  as aal1 / no factor ⇒ send to enrol). Returns `/security/mfa` or `null`.
- **Enforcement**: both authenticated shells — `(app)/layout.tsx` and
  `admin/layout.tsx` — call the gate and redirect when step-up is required.
- **Enrol / step-up page** `/security/mfa` (outside the `(app)` group, so the
  redirect can't loop): a client component using Supabase MFA
  `enroll`/`challenge`/`verify` — shows the TOTP QR + setup key on first
  enrolment, prompts for the 6-digit code on every step-up, signs out on demand.
  EN/DE/RO.

## Staging steps to arm it (in order)
1. **Enable MFA in the Supabase project** (Authentication → sign-in / providers →
   Multi-factor; allow TOTP). Without this, `enroll` fails and the fail-closed
   gate would strand required roles on `/security/mfa`.
2. Deploy with `MFA_ENFORCED=true` on **staging** first.
3. Sign in as each required role, scan the QR with an authenticator app, verify.
   Confirm: a required role with no factor is sent to `/security/mfa`; after
   enrolment the app is reachable; a fresh sign-in is challenged (aal1 → aal2);
   a non-required role (e.g. `EMPLOYEE`) is never redirected.
4. Confirm there is a **recovery path** for a lost device (super-admin can clear
   a user's factor via the Supabase admin API / dashboard) before arming
   production — otherwise a lost authenticator locks a privileged user out.
5. Flip `MFA_ENFORCED=true` in production.

## Deferred (per §8)
SSO (SAML/OIDC) stays deferred; MFA is the interim protection for the
high-privilege and health-data roles.
