import { redirect } from "next/navigation";
import { getRealPlatformUser } from "@/lib/auth/current-user";
import { stopImpersonation } from "@/lib/auth/impersonation";

// P13 §2.4: end a read-only impersonation session. A GET (so the read-only
// middleware block never catches it); clears the cookie and audits against the
// real super_admin, then returns to the console.
export async function GET() {
  const real = await getRealPlatformUser();
  await stopImpersonation(real?.id ?? null);
  redirect("/admin/users");
}
