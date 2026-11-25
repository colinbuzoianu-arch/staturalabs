import type { BroadcastAudienceModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { type MergedRecipient, mergeRecipients } from "./recipient-merge";

// Resolving an audience into actual humans. One place, used by publishing and
// by "Empfänger aktualisieren", so the two can never disagree.
//
// Two kinds of member come out of this:
//   * login accounts (PlatformUser) — addressed through COMPANY / SITE / ROLE
//     audiences, and through ORG_UNIT when a leader is scoped to that unit;
//   * employee records (Person) — addressed through ORG_UNIT / WORKSTATION via
//     their PersonAssignment, which is also how the training requirements are
//     derived (P7b). A person with a linked account is merged into one row.
//
// Person lookups go through the people compartment only; nothing here joins a
// person to an assessment record. A workstation audience reads
// PersonAssignment.workstationId — a plain column, the same path the
// instruction derivation already uses.

// Expand org units to include every descendant: a broadcast to a department
// reaches its teams (the prompt's "incl. sub-units"). Pure walker so the tree
// logic is testable; the caller supplies the (id, parentId) rows.
export function expandOrgUnitIds(
  roots: readonly string[],
  all: readonly { id: string; parentId: string | null }[],
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const unit of all) {
    if (!unit.parentId) continue;
    const list = childrenByParent.get(unit.parentId) ?? [];
    list.push(unit.id);
    childrenByParent.set(unit.parentId, list);
  }
  const out = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (out.has(id)) continue;
    out.add(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child);
  }
  return out;
}

type Member = {
  platformUserId?: string | null;
  personId?: string | null;
  audienceId: string;
};

// Tenant roles that receive broadcasts. super_admin / l3_support are platform
// staff with a null companyId and are never recipients of a tenant's message.
const RECIPIENT_ROLES = [
  "COMPANY_ADMIN",
  "SITE_ADMIN",
  "EHS_SPECIALIST",
  "MANAGER",
  "EMPLOYEE",
  "OCCUPATIONAL_PHYSICIAN",
  "WORKS_COUNCIL",
] as const;

async function companyAccounts(companyId: string): Promise<string[]> {
  const rows = await prisma.platformUser.findMany({
    where: {
      companyId,
      disabledAt: null,
      role: { in: [...RECIPIENT_ROLES] },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Accounts that cover one site: company-wide admins, the legacy SiteAssignment
// grants, and RoleAssignment rows scoped to the site or to an org unit on it.
async function siteAccounts(
  companyId: string,
  siteId: string,
): Promise<string[]> {
  const [admins, assigned, siteScoped, unitScoped] = await Promise.all([
    prisma.platformUser.findMany({
      where: { companyId, disabledAt: null, role: "COMPANY_ADMIN" },
      select: { id: true },
    }),
    prisma.siteAssignment.findMany({
      where: { siteId, user: { disabledAt: null } },
      select: { userId: true },
    }),
    prisma.roleAssignment.findMany({
      where: {
        revokedAt: null,
        scopeType: "SITE",
        scopeId: siteId,
        user: { disabledAt: null, companyId },
      },
      select: { platformUserId: true },
    }),
    prisma.orgUnit
      .findMany({ where: { siteId }, select: { id: true } })
      .then((units) =>
        units.length === 0
          ? []
          : prisma.roleAssignment.findMany({
              where: {
                revokedAt: null,
                scopeType: "ORG_UNIT",
                scopeId: { in: units.map((u) => u.id) },
                user: { disabledAt: null, companyId },
              },
              select: { platformUserId: true },
            }),
      ),
  ]);
  return [
    ...admins.map((a) => a.id),
    ...assigned.map((a) => a.userId),
    ...siteScoped.map((a) => a.platformUserId),
    ...unitScoped.map((a) => a.platformUserId),
  ];
}

// Active persons at a site: assigned to one of its workstations or org units,
// or whose home org unit is on it.
async function sitePersons(
  companyId: string,
  siteId: string,
): Promise<string[]> {
  const [units, workstations] = await Promise.all([
    prisma.orgUnit.findMany({ where: { siteId }, select: { id: true } }),
    prisma.workstation.findMany({ where: { siteId }, select: { id: true } }),
  ]);
  const unitIds = units.map((u) => u.id);
  const workstationIds = workstations.map((w) => w.id);
  const rows = await prisma.person.findMany({
    where: {
      companyId,
      active: true,
      anonymisedAt: null,
      OR: [
        { orgUnitId: { in: unitIds } },
        {
          assignments: {
            some: {
              OR: [
                { orgUnitId: { in: unitIds } },
                { workstationId: { in: workstationIds } },
              ],
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function orgUnitMembers(
  companyId: string,
  rootUnitId: string,
  audienceId: string,
): Promise<Member[]> {
  const root = await prisma.orgUnit.findUnique({
    where: { id: rootUnitId },
    select: { siteId: true, site: { select: { companyId: true } } },
  });
  // A unit in another tenant (or gone) resolves to nobody — never to everybody.
  if (!root || root.site.companyId !== companyId) return [];
  const all = await prisma.orgUnit.findMany({
    where: { siteId: root.siteId },
    select: { id: true, parentId: true },
  });
  const unitIds = [...expandOrgUnitIds([rootUnitId], all)];
  const workstations = await prisma.workstation.findMany({
    where: { orgUnitId: { in: unitIds } },
    select: { id: true },
  });
  const workstationIds = workstations.map((w) => w.id);

  const [persons, leaders] = await Promise.all([
    prisma.person.findMany({
      where: {
        companyId,
        active: true,
        anonymisedAt: null,
        OR: [
          { orgUnitId: { in: unitIds } },
          {
            assignments: {
              some: {
                OR: [
                  { orgUnitId: { in: unitIds } },
                  { workstationId: { in: workstationIds } },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
    }),
    // The leaders of those units get it too — they are responsible for passing
    // it on and must not have to hear about it second-hand.
    prisma.roleAssignment.findMany({
      where: {
        revokedAt: null,
        scopeType: "ORG_UNIT",
        scopeId: { in: unitIds },
        user: { disabledAt: null, companyId },
      },
      select: { platformUserId: true },
    }),
  ]);
  return [
    ...persons.map((p) => ({ personId: p.id, audienceId })),
    ...leaders.map((l) => ({ platformUserId: l.platformUserId, audienceId })),
  ];
}

async function workstationMembers(
  companyId: string,
  workstationId: string,
  audienceId: string,
): Promise<Member[]> {
  const workstation = await prisma.workstation.findUnique({
    where: { id: workstationId },
    select: { site: { select: { companyId: true } } },
  });
  if (!workstation || workstation.site.companyId !== companyId) return [];
  const persons = await prisma.person.findMany({
    where: {
      companyId,
      active: true,
      anonymisedAt: null,
      assignments: { some: { workstationId } },
    },
    select: { id: true },
  });
  return persons.map((p) => ({ personId: p.id, audienceId }));
}

// Every holder of a tenant role. Narrowed to the broadcast's site when it has
// one, so "all leaders" means the leaders of that site, not the company.
async function roleMembers(
  companyId: string,
  role: string,
  siteId: string | null,
  audienceId: string,
): Promise<Member[]> {
  const accounts = await prisma.platformUser.findMany({
    where: {
      companyId,
      disabledAt: null,
      role: role as (typeof RECIPIENT_ROLES)[number],
    },
    select: { id: true },
  });
  if (!siteId) {
    return accounts.map((a) => ({ platformUserId: a.id, audienceId }));
  }
  const onSite = new Set(await siteAccounts(companyId, siteId));
  return accounts
    .filter((a) => onSite.has(a.id))
    .map((a) => ({ platformUserId: a.id, audienceId }));
}

export type BroadcastForResolution = {
  companyId: string;
  siteId: string | null;
  audiences: readonly Pick<
    BroadcastAudienceModel,
    "id" | "scope" | "siteId" | "orgUnitId" | "workstationId" | "role"
  >[];
};

// Resolve the whole audience set into the merged recipient list. Every person
// is mapped to their linked login account (Person.platformUserId) before
// merging, so a worker with an account is one recipient with both ids.
export async function resolveBroadcastRecipients(
  broadcast: BroadcastForResolution,
): Promise<MergedRecipient[]> {
  const members: Member[] = [];

  for (const audience of broadcast.audiences) {
    switch (audience.scope) {
      case "COMPANY": {
        const [accounts, persons] = await Promise.all([
          companyAccounts(broadcast.companyId),
          prisma.person.findMany({
            where: {
              companyId: broadcast.companyId,
              active: true,
              anonymisedAt: null,
            },
            select: { id: true },
          }),
        ]);
        members.push(
          ...accounts.map((id) => ({
            platformUserId: id,
            audienceId: audience.id,
          })),
          ...persons.map((p) => ({ personId: p.id, audienceId: audience.id })),
        );
        break;
      }
      case "SITE": {
        if (!audience.siteId) break;
        const [accounts, persons] = await Promise.all([
          siteAccounts(broadcast.companyId, audience.siteId),
          sitePersons(broadcast.companyId, audience.siteId),
        ]);
        members.push(
          ...accounts.map((id) => ({
            platformUserId: id,
            audienceId: audience.id,
          })),
          ...persons.map((id) => ({ personId: id, audienceId: audience.id })),
        );
        break;
      }
      case "ORG_UNIT": {
        if (!audience.orgUnitId) break;
        members.push(
          ...(await orgUnitMembers(
            broadcast.companyId,
            audience.orgUnitId,
            audience.id,
          )),
        );
        break;
      }
      case "WORKSTATION": {
        if (!audience.workstationId) break;
        members.push(
          ...(await workstationMembers(
            broadcast.companyId,
            audience.workstationId,
            audience.id,
          )),
        );
        break;
      }
      case "ROLE": {
        if (!audience.role) break;
        members.push(
          ...(await roleMembers(
            broadcast.companyId,
            audience.role,
            broadcast.siteId,
            audience.id,
          )),
        );
        break;
      }
      default:
        break;
    }
  }

  // Map persons to their login account before merging.
  const personIds = [
    ...new Set(
      members.map((m) => m.personId).filter((id): id is string => !!id),
    ),
  ];
  const linked =
    personIds.length > 0
      ? await prisma.person.findMany({
          where: { id: { in: personIds } },
          select: { id: true, platformUserId: true },
        })
      : [];
  const accountByPerson = new Map(
    linked
      .filter((p) => p.platformUserId)
      .map((p) => [p.id, p.platformUserId as string]),
  );

  return mergeRecipients(
    members.map((m) => ({
      audienceId: m.audienceId,
      personId: m.personId ?? null,
      platformUserId:
        m.platformUserId ??
        (m.personId ? (accountByPerson.get(m.personId) ?? null) : null),
    })),
  );
}
