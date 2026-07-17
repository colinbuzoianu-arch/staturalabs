import "server-only";

import { prisma } from "@/lib/prisma";

// The active MethodologyVersion is data (§3.8), not a code constant — see
// the model doc comment in schema.prisma. Zero active rows is a
// misconfiguration, not "no version selected yet": fail closed rather than
// falling back to some other version or a hardcoded default.
export async function getActiveMethodologyVersion(): Promise<string> {
  const active = await prisma.methodologyVersion.findFirst({
    where: { isActive: true },
  });

  if (!active) {
    throw new Error(
      "No active MethodologyVersion found — cannot score without one",
    );
  }

  return active.version;
}
