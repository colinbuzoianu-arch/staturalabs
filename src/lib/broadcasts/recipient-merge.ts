// Merging resolved audience members into the recipient snapshot. Pure, so the
// dedupe rules — the part most likely to double-notify someone — are tested
// without a database.
//
// The snapshot has ONE row per human, and a human can be reached two ways:
//   * as a login account (platformUserId), e.g. an EHS specialist addressed
//     through a ROLE audience;
//   * as an employee record (personId), e.g. a worker addressed through the
//     workstation they are assigned to.
// A person who HAS an account is one recipient, not two: the row carries both
// ids, so the inbox finds them by account and the status view can still show
// their name from the people compartment.

export type ResolvedMember = {
  platformUserId?: string | null;
  personId?: string | null;
  // Which audience row pulled them in (the "why" the status view shows).
  audienceId: string;
};

export type MergedRecipient = {
  platformUserId: string | null;
  personId: string | null;
  audienceId: string;
};

// Identity key: the account if there is one, otherwise the person. That is what
// makes "the same worker, reached through their workstation AND through a role
// audience" collapse to one row.
function identityKey(member: {
  platformUserId?: string | null;
  personId?: string | null;
}): string | null {
  if (member.platformUserId) return `user:${member.platformUserId}`;
  if (member.personId) return `person:${member.personId}`;
  return null;
}

export function mergeRecipients(
  members: readonly ResolvedMember[],
): MergedRecipient[] {
  const byIdentity = new Map<string, MergedRecipient>();
  // A person seen first without an account and later with one must end up as a
  // single row, so remember which person ids we have already placed.
  const rowByPerson = new Map<string, MergedRecipient>();

  for (const member of members) {
    const platformUserId = member.platformUserId ?? null;
    const personId = member.personId ?? null;
    if (!platformUserId && !personId) continue; // no identity → not a recipient

    // Already placed under this person? Enrich it with the account instead of
    // adding a second row.
    if (personId) {
      const existingForPerson = rowByPerson.get(personId);
      if (existingForPerson) {
        if (platformUserId && !existingForPerson.platformUserId) {
          existingForPerson.platformUserId = platformUserId;
          byIdentity.set(`user:${platformUserId}`, existingForPerson);
        }
        continue;
      }
    }

    const key = identityKey({ platformUserId, personId });
    if (!key) continue;
    const existing = byIdentity.get(key);
    if (existing) {
      // Same account seen again, this time with the person behind it.
      if (personId && !existing.personId) {
        existing.personId = personId;
        rowByPerson.set(personId, existing);
      }
      continue;
    }

    const row: MergedRecipient = {
      platformUserId,
      personId,
      // First audience wins the attribution: the earliest reason this person
      // was addressed, which is the one a sender recognises.
      audienceId: member.audienceId,
    };
    byIdentity.set(key, row);
    if (personId) rowByPerson.set(personId, row);
  }

  return [...new Set(byIdentity.values())];
}

// What a refresh has to add: members in the freshly resolved set that the
// stored snapshot does not hold yet. Existing rows are NEVER rewritten — their
// readAt/confirmedAt stamps are the proof trail.
export function newRecipientsSince(
  stored: readonly {
    platformUserId: string | null;
    personId: string | null;
  }[],
  resolved: readonly MergedRecipient[],
): MergedRecipient[] {
  const knownUsers = new Set(
    stored
      .map((r) => r.platformUserId)
      .filter((id): id is string => id !== null),
  );
  const knownPersons = new Set(
    stored.map((r) => r.personId).filter((id): id is string => id !== null),
  );
  return resolved.filter((r) => {
    if (r.platformUserId && knownUsers.has(r.platformUserId)) return false;
    if (r.personId && knownPersons.has(r.personId)) return false;
    return true;
  });
}
