import { renderToBuffer } from "@react-pdf/renderer";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import type { PlatformRole } from "@/generated/prisma/enums";
import { userCan } from "@/lib/auth/company-role-bundle";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import {
  groupByPart,
  HANDBOOK_PART_TITLES,
  visibleChapters,
} from "@/lib/handbook/chapters";
import { markdownToPdfBlocks } from "@/lib/handbook/pdf-blocks";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import {
  HandbookDocument,
  type HandbookPdfData,
} from "@/lib/report/HandbookDocument";

// P18 B.1: the handbook as a PDF — the whole book, or one role's selection
// (`?role=MANAGER`). These are the files the founder sends to prospects.
//
// German, like every other document this app generates for a DACH reader, and
// built from the same Markdown as the in-app renderer.
//
// Scoping: a reader may export at most what they can read in the app. Asking
// for another role's PDF is allowed — it is the SAME public handbook, and a
// prospect asking "what does an employee see?" is a fair question — but the
// INTERNAL chapters are filtered by the requester's own role, so a tenant
// cannot export the super-admin chapter by passing ?role=SUPER_ADMIN.
export async function GET(request: Request) {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  if (!(await userCan(user, "help.read"))) notFound();

  const url = new URL(request.url);
  // German role names, from the one place P17 slice 1 put them.
  const roleLabels = getAdministrationDictionary("de").usersPage.roleLabels;
  const requested = url.searchParams.get("role");
  const roleFilter =
    requested && requested in roleLabels ? (requested as PlatformRole) : null;
  // What the REQUESTER may see (this is what keeps internal chapters in).
  const readable = visibleChapters(HANDBOOK_CHAPTERS, user.role);
  // Then, optionally, narrow to one role's selection for the role PDF.
  const selected = roleFilter
    ? readable.filter(
        (c) => c.roles.length === 0 || c.roles.includes(roleFilter),
      )
    : readable;

  if (selected.length === 0) notFound();

  const groups = groupByPart(selected);
  const data: HandbookPdfData = {
    title: "Benutzerhandbuch",
    subtitle: "Statura Labs Dynamics — Arbeitnehmerschutz und Umwelt",
    version: `Handbuch ${HANDBOOK_CHAPTERS.length} Kapitel`,
    generatedOn: new Date().toISOString().slice(0, 10),
    roleLabel: roleFilter ? `Für die Rolle: ${roleLabels[roleFilter]}` : null,
    contents: groups.map((g) => ({
      partTitle: g.title,
      chapterTitles: g.chapters.map((c) => c.title),
    })),
    chapters: selected.map((chapter) => ({
      title: chapter.title,
      partTitle: HANDBOOK_PART_TITLES[chapter.part],
      blocks: markdownToPdfBlocks(chapter.markdown),
    })),
    footer:
      "Benutzerhandbuch · Statura Labs Dynamics · Keine Rechtsberatung; gesetzliche Verweise stammen aus dem geprüften Rechtskataster.",
  };

  const buffer = await renderToBuffer(
    createElement(HandbookDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );
  const fileName = roleFilter
    ? `statura-handbuch-${roleFilter.toLowerCase()}.pdf`
    : "statura-handbuch.pdf";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
