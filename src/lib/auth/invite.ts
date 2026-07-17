import "server-only";

import { PlatformRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/server";

type InvitePlatformUserInput = {
  email: string;
  name: string;
  role: PlatformRole;
  companyId: string | null;
};

// The only path that creates a platform_user row — there is no public
// sign-up form or API route anywhere in this app. Callers (an internal
// admin action, not yet built) are responsible for checking the *inviter*
// is authorized to grant the requested role/company via
// `@/lib/auth/rbac` before calling this.
//
// Two systems have to agree for a platform_user to exist: Supabase auth
// (the login credential) and this table (the role/company grant). We
// create the auth side first via `inviteUserByEmail` — which emails the
// invite and never sets a password, so there is no self-service signup
// path that bypasses it — then the platform_user row keyed on the same id.
// If the second step fails, we remove the auth user rather than leave a
// login with no platform access it can never resolve to.
export async function invitePlatformUser(input: InvitePlatformUserInput) {
  assertRoleCompanyInvariant(input.role, input.companyId);

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: { name: input.name, role: input.role, companyId: input.companyId },
    },
  );

  if (error || !data.user) {
    throw new Error(
      `Failed to send invite: ${error?.message ?? "no user returned"}`,
    );
  }

  try {
    return await prisma.platformUser.create({
      data: {
        id: data.user.id,
        email: input.email,
        name: input.name,
        role: input.role,
        companyId: input.companyId,
      },
    });
  } catch (err) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw err;
  }
}

// Mirrors the PlatformUser_role_companyId_check DB constraint, so a bad
// call fails fast with a clear message instead of a raw Postgres error
// (and, unlike the DB check, before an invite email has already gone out).
function assertRoleCompanyInvariant(
  role: PlatformRole,
  companyId: string | null,
) {
  const requiresCompany =
    role === PlatformRole.COMPANY_ADMIN || role === PlatformRole.SITE_ADMIN;

  if (requiresCompany && !companyId) {
    throw new Error(`Role ${role} requires a companyId`);
  }
  if (!requiresCompany && companyId) {
    throw new Error(`Role ${role} must not have a companyId`);
  }
}
