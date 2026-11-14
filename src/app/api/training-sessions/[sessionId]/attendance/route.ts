import { renderToBuffer } from "@react-pdf/renderer";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { canAccessCompany } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
  type TrainingAttendanceData,
  TrainingAttendanceDocument,
} from "@/lib/report/TrainingAttendanceDocument";

// P17 §4: the Unterweisungsnachweis (attendance list) for a training session.
// Company-scoped (a session has no siteId); auth = authenticated + training.read
// + canAccessCompany on the session's company — the same compose model the
// rest of the app uses (permission = what, scope = where). People-compartment
// training proof; no assessment-chain or health data.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "training.read")) notFound();

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      companyId: true,
      date: true,
      location: true,
      instructor: true,
      status: true,
      requirementType: { select: { title: true } },
      participants: {
        orderBy: { person: { lastName: "asc" } },
        select: {
          status: true,
          signatureConfirmed: true,
          person: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!session) notFound();
  if (!canAccessCompany(user, session.companyId)) notFound();

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
