import { createHash, randomInt } from "node:crypto";

// P17 §5 (SLD_P17_TENANT_ROLES_APPROVED.md): the one-time access code a
// production worker without a company e-mail uses to claim their account
// (personnel number + code → set own password). Pure/deterministic helpers,
// unit-tested; the DB work lives in employee-account.ts.
//
// Alphabet: Crockford-style base32 minus the characters that are misread off a
// printed sheet (I, L, O, U, 0, 1). A code is 10 characters of ~5 bits = ~51
// bits of entropy, generated with randomInt (CSPRNG), printed in two groups of
// five. Only the SHA-256 hash is ever stored.
export const ACCESS_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ACCESS_CODE_LENGTH = 10;
export const ACCESS_CODE_DEFAULT_VALIDITY_DAYS = 14;
// Re-exported for the server-side callers that already import from here; it
// LIVES in employee-password.ts because this module pulls node:crypto and the
// sign-in form (a client component) needs the same number.
export { EMPLOYEE_PASSWORD_MIN_LENGTH } from "./employee-password";

export function generateAccessCode(length = ACCESS_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }
  return out;
}

// What the sheet prints: "ABCDE-FGHJK". Purely cosmetic — normalizeAccessCode
// strips the separator again on redemption.
export function formatAccessCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

// Accept what a person can plausibly type: lower case, spaces, hyphens. Does
// NOT map look-alikes (O→0 etc.) — the alphabet excludes them, so a typed "O"
// is a genuine mistake, and silently rewriting it would widen the keyspace.
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashAccessCode(code: string): string {
  return createHash("sha256").update(normalizeAccessCode(code)).digest("hex");
}

export type AccessCodeState = {
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

export type AccessCodeUsability =
  | { usable: true }
  | { usable: false; reason: "used" | "revoked" | "expired" };

// Fail-closed: anything other than an unused, unrevoked, unexpired code is
// rejected with the reason, which the route turns into one generic message (it
// never tells an unauthenticated caller WHICH of the three it was).
export function accessCodeUsability(
  state: AccessCodeState,
  now: Date,
): AccessCodeUsability {
  if (state.usedAt) return { usable: false, reason: "used" };
  if (state.revokedAt) return { usable: false, reason: "revoked" };
  if (state.expiresAt.getTime() <= now.getTime()) {
    return { usable: false, reason: "expired" };
  }
  return { usable: true };
}

export function accessCodeExpiry(
  now: Date,
  validityDays = ACCESS_CODE_DEFAULT_VALIDITY_DAYS,
): Date {
  return new Date(now.getTime() + validityDays * 86_400_000);
}

// The synthetic, non-deliverable login identifier for an employee account with
// no company e-mail. Supabase Auth keys an account on an e-mail address, so one
// has to exist — it is deliberately on the reserved `.invalid` TLD (RFC 2606),
// so it can never receive or send mail, and carries the company id so two
// tenants can reuse the same personnel number.
export function syntheticEmployeeEmail(
  companyId: string,
  personnelNumber: string,
): string {
  const local = normalizeAccessCode(personnelNumber).toLowerCase();
  return `pn-${local}.${companyId.toLowerCase()}@employee.sld.invalid`;
}

export function isSyntheticEmployeeEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@employee.sld.invalid");
}
