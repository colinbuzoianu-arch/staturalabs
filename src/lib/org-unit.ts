import type { OrgUnitType } from "@/generated/prisma/enums";
import type { OrgUnitModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here — same reasoning as
// assessment-session.ts and scoring/lookup.ts: this file needs to be
// directly unit-testable, and that package throws outside a
// "react-server" module-resolution condition, which Vitest doesn't set.

// Not empirically tuned — matches the four OrgUnitType values conceptually
// forming a bounded hierarchy (PLANT -> DEPARTMENT -> AREA -> LINE). Not
// enforced type-by-type (nothing stops a LINE parenting another LINE), just
// a sanity backstop against a runaway or malformed tree.
export const MAX_ORG_UNIT_DEPTH = 4;

type OrgUnitAncestor = { siteId: string; parentId: string | null };

// Pure core — exported for direct unit testing against an in-memory graph,
// no DB involved (same split as matchScoringRule in scoring/lookup.ts).
// `nodes` must already contain every ancestor starting at `parentId`
// (fetchOrgUnitAncestry below builds it); this function only walks and
// validates what it's given.
//
// Checks, in order: the direct parent belongs to the same site as the new
// node (siteId is denormalised onto every OrgUnit precisely so this is a
// cheap check, never a tree walk); the parent chain contains no cycle; and
// including the new leaf node, total depth doesn't exceed maxDepth. A
// brand-new node can't itself introduce a cycle (its id doesn't exist yet —
// it's about to be created), but walking the chain regardless also guards
// against a tree that's already corrupted.
export function validateOrgUnitParent(
  parentId: string,
  siteId: string,
  nodes: ReadonlyMap<string, OrgUnitAncestor>,
  maxDepth: number = MAX_ORG_UNIT_DEPTH,
): void {
  const parent = nodes.get(parentId);
  if (!parent) {
    throw new Error(`OrgUnit parent ${parentId} does not exist`);
  }
  if (parent.siteId !== siteId) {
    throw new Error(
      `OrgUnit parent belongs to a different site (parent.siteId=${parent.siteId}, requested siteId=${siteId})`,
    );
  }

  const visited = new Set<string>();
  let depth = 1; // the new node itself
  let currentId: string | null = parentId;

  while (currentId !== null) {
    if (visited.has(currentId)) {
      throw new Error(`OrgUnit parent chain contains a cycle at ${currentId}`);
    }
    visited.add(currentId);
    depth += 1;
    if (depth > maxDepth) {
      throw new Error(
        `OrgUnit depth would exceed MAX_ORG_UNIT_DEPTH (${maxDepth})`,
      );
    }

    const node = nodes.get(currentId);
    if (!node) {
      throw new Error(`OrgUnit parent ${currentId} does not exist`);
    }
    currentId = node.parentId;
  }
}

// Fetches the ancestor chain starting at `parentId`, one row per hop.
// Bounded well beyond MAX_ORG_UNIT_DEPTH so a genuinely cyclic/corrupted
// tree already in the DB can't spin this loop forever — validateOrgUnitParent
// is what actually detects and reports a cycle once the chain is in memory;
// this just needs to stop feeding it.
async function fetchOrgUnitAncestry(
  parentId: string,
): Promise<Map<string, OrgUnitAncestor>> {
  const nodes = new Map<string, OrgUnitAncestor>();
  const hardFetchLimit = MAX_ORG_UNIT_DEPTH + 10;
  let currentId: string | null = parentId;

  for (let i = 0; i < hardFetchLimit && currentId !== null; i++) {
    if (nodes.has(currentId)) break; // already-visited id — let the validator report the cycle
    const node: OrgUnitAncestor | null = await prisma.orgUnit.findUnique({
      where: { id: currentId },
      select: { siteId: true, parentId: true },
    });
    if (!node) break; // dangling/missing id — let the validator report it
    nodes.set(currentId, node);
    currentId = node.parentId;
  }

  return nodes;
}

export type CreateOrgUnitInput = {
  siteId: string;
  parentId?: string | null;
  type: OrgUnitType;
  name: string;
  code?: string | null;
};

// The single gate for creating an OrgUnit — enforces that a child belongs
// to the same site as its parent and that the resulting tree stays acyclic
// and bounded (see validateOrgUnitParent). siteId itself is never derived
// from the parent: it's always supplied explicitly and only cross-checked,
// per the load-bearing decision in schema.prisma/CLAUDE.md that the org
// tree must never become load-bearing for authorization.
export async function createOrgUnit(
  input: CreateOrgUnitInput,
): Promise<OrgUnitModel> {
  const parentId = input.parentId ?? null;

  if (parentId !== null) {
    const nodes = await fetchOrgUnitAncestry(parentId);
    validateOrgUnitParent(parentId, input.siteId, nodes);
  }

  return prisma.orgUnit.create({
    data: {
      siteId: input.siteId,
      parentId,
      type: input.type,
      name: input.name,
      code: input.code ?? null,
    },
  });
}
