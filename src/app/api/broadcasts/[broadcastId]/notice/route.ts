import { renderToBuffer } from "@react-pdf/renderer";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";
import { userCan } from "@/lib/auth/company-role-bundle";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { broadcastBodyToText } from "@/lib/broadcasts/sanitise";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { prisma } from "@/lib/prisma";
import { archiveGeneratedDocument } from "@/lib/report/archive-generated-document";
import {
  type BroadcastNoticeData,
  BroadcastNoticeDocument,
} from "@/lib/report/BroadcastNoticeDocument";

// The printable notice-board version (A4, German), archived in the
// content-addressed GeneratedDocument archive like every other generated PDF —
// so what was pinned up is recoverable byte-for-byte later.
//
// German regardless of the viewer's UI language, the same call the SGD and the
// Betriebsanweisung make: what goes on a DACH notice board is read by the
// workforce, not by whoever generated it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ broadcastId: string }> },
) {
  const { broadcastId } = await params;
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  // Producing the aushang is a sender action.
  if (!(await userCan(user, "broadcasts.write"))) notFound();

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: {
      id: true,
      companyId: true,
      siteId: true,
      title: true,
      body: true,
      priority: true,
      domain: true,
      status: true,
      publishedAt: true,
      requiresConfirmation: true,
      confirmationDueAt: true,
      createdByUserId: true,
      company: { select: { name: true } },
      site: { select: { name: true, country: true } },
    },
  });
  if (!broadcast || broadcast.companyId !== user.companyId) notFound();
  // Only a published message is pinned up: a draft has not been said yet.
  if (broadcast.status === "DRAFT") notFound();

  // The notice names the sender's ROLE, never personal details.
  const sender = broadcast.createdByUserId
    ? await prisma.platformUser.findUnique({
        where: { id: broadcast.createdByUserId },
        select: { role: true },
      })
    : null;

  const de = getAdministrationDictionary("de");
  const dict = de.broadcasts;

  // A company-wide broadcast has no site of its own; archive it against the
  // site the generating user is anchored to via its country, falling back to
  // the company's first site, so the archive row always has a real site.
  const archiveSite = broadcast.site
    ? {
        name: broadcast.site.name,
        country: broadcast.site.country,
        id: broadcast.siteId as string,
      }
    : await prisma.site
        .findFirst({
          where: { companyId: broadcast.companyId },
          select: { id: true, name: true, country: true },
          orderBy: { name: "asc" },
        })
        .then((s) =>
          s ? { id: s.id, name: s.name, country: s.country } : null,
        );
  if (!archiveSite) notFound();

  const data: BroadcastNoticeData = {
    title: broadcast.title,
    bodyText: broadcastBodyToText(broadcast.body),
    publishedAt: broadcast.publishedAt?.toISOString().slice(0, 10) ?? null,
    priorityLabel: dict.priorityLabels[broadcast.priority],
    domainLabel: dict.domainLabels[broadcast.domain],
    senderRoleLabel: sender
      ? de.usersPage.roleLabels[sender.role]
      : dict.senderLabel,
    companyName: broadcast.company.name,
    siteName: broadcast.site?.name ?? dict.scopeCompany,
    confirmationDueAt:
      broadcast.confirmationDueAt?.toISOString().slice(0, 10) ?? null,
    requiresConfirmation: broadcast.requiresConfirmation,
    isSafetyAlert: broadcast.priority === "SAFETY_ALERT",
  };

  const buffer = await renderToBuffer(
    createElement(BroadcastNoticeDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  // Best-effort archive: a failed upload must not stop the sender printing the
  // notice they need on the wall now.
  try {
    await archiveGeneratedDocument({
      type: "BROADCAST_NOTICE",
      companyId: broadcast.companyId,
      siteId: archiveSite.id,
      title: broadcast.title,
      country: archiveSite.country,
      generatedByUserId: user.id,
      versions: { broadcastId: broadcast.id },
      buffer,
    });
  } catch (error) {
    console.warn(`[broadcasts] archiving the notice failed: ${String(error)}`);
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aushang-sicherheitsinformation-${broadcastId}.pdf"`,
    },
  });
}
