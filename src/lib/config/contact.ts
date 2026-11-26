// P18 A.3/A.4: the ONE configured contact address.
//
// The trial band's "Fragen? Kontakt aufnehmen" link and the founder's copy of
// the expiry reminders both need an address. Sandbox-readiness rule 2's
// principle applies to e-mail just as it does to URLs: anything leaving the
// app resolves from configuration, never from a literal in a component.
//
// Two separate settings on purpose:
//   TRIAL_CONTACT_EMAIL — shown to the PROSPECT (the band's mailto).
//   TRIAL_NOTIFY_EMAIL  — where the founder's copies go (never shown).
// Unset → null, and every caller omits the link or the copy rather than
// inventing an address.

export function trialContactAddress(
  env: string | undefined = process.env.TRIAL_CONTACT_EMAIL,
): string | null {
  const value = env?.trim();
  return value?.includes("@") ? value : null;
}

export function trialNotifyAddress(
  env: string | undefined = process.env.TRIAL_NOTIFY_EMAIL,
): string | null {
  const value = env?.trim();
  return value?.includes("@") ? value : null;
}

// A mailto: with a pre-filled subject, so a prospect's question arrives with
// the tenant it is about. Null when no address is configured.
export function trialContactMailto(
  companyName: string,
  env?: string,
): string | null {
  const address = trialContactAddress(env);
  if (!address) return null;
  const subject = encodeURIComponent(
    `Statura Labs — Testzugang ${companyName}`,
  );
  return `mailto:${address}?subject=${subject}`;
}
