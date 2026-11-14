// Sandbox-readiness: base path + cookie scoping (SLD_SANDBOX_READINESS_RULES.md).
// The later sandbox runs the SAME codebase at staturalabs.com/sandbox, built with
// BASE_PATH=/sandbox and a mirrored NEXT_PUBLIC_BASE_PATH so the client agrees.
// Today both are unset → BASE_PATH "" and cookie names unchanged (zero behaviour
// change). NEXT_PUBLIC_* is used for anything the client must also see, so the
// server and the browser compute the SAME cookie namespace (rule 3 — cookies must
// not collide between / and /sandbox on one domain). next.config reads BASE_PATH
// at build time for Next's own basePath.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const COOKIE_SUFFIX = BASE_PATH.replace(/[^a-z0-9]/gi, "");

// A cookie name unique to this deployment. "" base path → the plain name.
export function scopedCookieName(name: string): string {
  return COOKIE_SUFFIX ? `${name}__${COOKIE_SUFFIX}` : name;
}
