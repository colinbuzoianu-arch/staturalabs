// P17 §5: the employee-chosen password rule, in its own module with NO node:
// imports on purpose — the access-code sign-in form is a client component and
// must be able to show the same minimum the server enforces without pulling
// node:crypto (which access-code.ts needs) into the browser bundle.
//
// Supabase's own floor is 6; 10 is SLD's, stated in one place so the route,
// the gate and the form can never disagree.
export const EMPLOYEE_PASSWORD_MIN_LENGTH = 10;
