// P13 §4 security headers. Applied to every response via next.config headers().
// Kept here as data so the set is testable and documented in one place.
//
// CSP is shipped REPORT-ONLY first: a strict enforcing CSP for a Next.js app
// needs per-request nonces (Next injects inline bootstrap scripts), and getting
// it wrong silently breaks hydration. Report-only lets us watch for violations
// on staging (browser console / a report endpoint) and promote it to enforcing
// — the same flag-gated/staging discipline as RLS and MFA. The static headers
// below are safe to enforce immediately.

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Next.js injects inline bootstrap + uses eval in dev; keep 'unsafe-inline'/
  // 'unsafe-eval' in the report-only policy and tighten with nonces on the
  // enforcing promotion.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "font-src 'self'",
  // The browser Supabase client talks to the project API/auth over https.
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS: { key: string; value: string }[] = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    // The product has no camera/microphone/geolocation use (camera removed for
    // GDPR); deny them outright.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];
