import { redeemAccessCode } from "@/lib/people/employee-account";
import { EMPLOYEE_PASSWORD_MIN_LENGTH } from "@/lib/people/employee-password";

// P17 §5: the only UNAUTHENTICATED write endpoint in the app besides sign-in
// itself — an employee without a company e-mail claims their account with
// personnel number + one-time access code and sets their own password.
//
// It deliberately returns only { email } on success: the client then performs
// a normal signInWithPassword with the password the person just chose, so the
// session is created by Supabase exactly like every other sign-in and this
// route never mints a token.
//
// Every failure other than a too-short password is the same generic 400
// ("invalid"), so the endpoint cannot be used to enumerate personnel numbers
// or probe codes. Brute-force rate limiting needs the shared store the P13 §4
// checklist already defers (SLD_P13_PREPROD_CHECKLIST.md); the one-time,
// single-live, 14-day-expiring ~51-bit code is the interim control, and a
// redeemed or superseded code is dead immediately.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const personnelNumber =
    typeof b.personnelNumber === "string" ? b.personnelNumber : "";
  const code = typeof b.code === "string" ? b.code : "";
  const newPassword = typeof b.newPassword === "string" ? b.newPassword : "";

  if (personnelNumber.trim().length === 0 || code.trim().length === 0) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  if (newPassword.length < EMPLOYEE_PASSWORD_MIN_LENGTH) {
    return Response.json(
      { error: "weak-password", minLength: EMPLOYEE_PASSWORD_MIN_LENGTH },
      { status: 400 },
    );
  }

  const result = await redeemAccessCode({ personnelNumber, code, newPassword });
  if (!result.ok) {
    return Response.json(
      result.reason === "weak-password"
        ? { error: "weak-password", minLength: EMPLOYEE_PASSWORD_MIN_LENGTH }
        : { error: "invalid" },
      { status: 400 },
    );
  }
  return Response.json({ email: result.email }, { status: 200 });
}
