import { prisma } from "@/lib/prisma";

// The one subject helper (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.2 rule 1,
// §10). Every record in every module hangs off a Site (siteId NOT NULL,
// authorization stays site-based), optionally NARROWED to a subject: an
// OrgUnit, Workstation, Process or Task. This module is the single place that
// answers "does this subject belong to this site" — so no module reimplements
// the cross-site check the way addTaskToProcess (src/lib/process.ts) first had
// to, and a process/inspection/finding can never silently reach across sites.
//
// No `import "server-only"`: thin gate over `@/lib/prisma`, unit-tested with a
// mocked client, same reasoning as process.ts / action.ts.
//
// Subjects all expose their site differently — OrgUnit/Workstation/Process
// carry `siteId` directly, a Task reaches it through its Workstation — so the
// resolver below is the one place that knows those shapes.

export type SubjectType = "ORG_UNIT" | "WORKSTATION" | "PROCESS" | "TASK";

export type SubjectRef = {
  type: SubjectType;
  id: string;
};

// Resolve the site a subject belongs to, or throw if the subject doesn't
// exist. Never returns null — a missing subject is a programming/authorization
// error, not a routine condition, same posture as process.ts's "does not
// exist" throws.
export async function resolveSubjectSiteId(
  subject: SubjectRef,
): Promise<string> {
  switch (subject.type) {
    case "ORG_UNIT": {
      const row = await prisma.orgUnit.findUnique({
        where: { id: subject.id },
        select: { siteId: true },
      });
      if (!row) throw new Error(`OrgUnit ${subject.id} does not exist`);
      return row.siteId;
    }
    case "WORKSTATION": {
      const row = await prisma.workstation.findUnique({
        where: { id: subject.id },
        select: { siteId: true },
      });
      if (!row) throw new Error(`Workstation ${subject.id} does not exist`);
      return row.siteId;
    }
    case "PROCESS": {
      const row = await prisma.process.findUnique({
        where: { id: subject.id },
        select: { siteId: true },
      });
      if (!row) throw new Error(`Process ${subject.id} does not exist`);
      return row.siteId;
    }
    case "TASK": {
      const row = await prisma.task.findUnique({
        where: { id: subject.id },
        select: { workstation: { select: { siteId: true } } },
      });
      if (!row) throw new Error(`Task ${subject.id} does not exist`);
      return row.workstation.siteId;
    }
    default: {
      // Exhaustive by construction: a SubjectType added without a case here
      // fails to compile. Any value slipping through at runtime fails closed.
      const _exhaustive: never = subject.type;
      throw new Error(`Unknown subject type: ${String(_exhaustive)}`);
    }
  }
}

// Throw unless the subject belongs to the given site — the gate a module calls
// before attaching a record scoped to (site, subject). Mirrors
// addTaskToProcess's cross-site rejection, generalised to every subject type.
export async function assertSubjectBelongsToSite(
  subject: SubjectRef,
  siteId: string,
): Promise<void> {
  const subjectSiteId = await resolveSubjectSiteId(subject);
  if (subjectSiteId !== siteId) {
    throw new Error(
      `Subject ${subject.type} ${subject.id} belongs to a different site ` +
        `(subject.siteId=${subjectSiteId}, requested siteId=${siteId}) — ` +
        `a record cannot reach across sites`,
    );
  }
}
