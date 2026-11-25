import { renderToBuffer } from "@react-pdf/renderer";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { accessibleOrgUnitIds } from "@/lib/auth/scope";
import { isSessionVisible } from "@/lib/people/session-visibility";
import { prisma } from "@/lib/prisma";
import {
  type TrainingAttendanceData,
  TrainingAttendanceDocument,
} from "@/lib/report/TrainingAttendanceDocument";

// P17 §4: the Unterweisungsnachweis (attendance list) for a training session.
// Company-scoped (a session has no siteId); auth = authenticated +
// training.write + the session being within the viewer's org-unit scope.
//
// Slice 8 fixed two things here, both found in the walkthrough:
//   * it required canAccessCompany, which no org-unit-scoped role has — so the
//     leader who had just recorded the attendance got a 404 downloading the
//     proof of it, although §4 explicitly gives them this document;
//   * it required only training.read, which the EMPLOYEE role also holds — an
//     employee could have pulled any session's list of colleague names. The
//     document belongs to whoever ORGANISES training (training.write).
// Scope now goes through the one shared rule (isSessionVisible), the same one
// the sessions list uses. People-compartment training proof; no
// assessment-chain or health data.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "training.write")) notFound();

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      companyId: true,
      date: true,
      location: true,
      instructor: true,
      status: true,
      plannedByUserId: true,
      requirementType: { select: { title: true } },
      participants: {
        orderBy: { person: { lastName: "asc" } },
        select: {
          status: true,
          signatureConfirmed: true,
          person: {
            select: { firstName: true, lastName: true, orgUnitId: true },
          },
        },
      },
    },
  });
  if (!session) notFound();
  // Tenant isolation first, then org-unit scope.
  if (!user.companyId || user.companyId !== session.companyId) notFound();
  if (
    !isSessionVisible(
      {
        plannedByUserId: session.plannedByUserId,
        participantOrgUnitIds: session.participants.map(
          (p) => p.person.orgUnitId,
        ),
      },
      await accessibleOrgUnitIds(user),
      user.id,
    )
  ) {
    notFound();
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { name: true },
  });

  const data: TrainingAttendanceData = {
    title: session.requirementType.title,
    date: session.date.toISOString().slice(0, 10),
    instructor: session.instructor,
    location: session.location,
    status: session.status,
    companyName: company?.name ?? "",
    participants: session.participants.map((p) => ({
      name: `${p.person.lastName}, ${p.person.firstName}`,
      attended: p.status === "ATTENDED",
      signed: p.signatureConfirmed,
    })),
  };

  const buffer = await renderToBuffer(
    createElement(TrainingAttendanceDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="unterweisungsnachweis-${sessionId}.pdf"`,
    },
  });
}
