import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";
import { OVERVIEW_SECTIONS } from "@/generated/overview";
import { userCan } from "@/lib/auth/company-role-bundle";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { markdownToPdfBlocks } from "@/lib/handbook/pdf-blocks";
import {
  coverageMarkdown,
  getLegalCoverage,
} from "@/lib/report/overview-coverage";
import {
  type OverviewPdfData,
  ProductOverviewDocument,
} from "@/lib/report/ProductOverviewDocument";

// P18 B.4: GET /api/overview/pdf — the Produktüberblick, German, about ten
// pages, built from docs/ueberblick/de/** and the installation's own active
// legal catalogue.
//
// Access: any signed-in user who may read the help (`help.read`, which every
// tenant role holds). This is a sales document about the product, not tenant
// data — the only figures in it are the counts of the SHARED system
// catalogue, never a company's own rows. There is no public, unauthenticated
// route for it: the founder sends the file, the app does not host a download
// for anyone who finds the URL.
const COVERAGE_MARKER = "{{RECHTSABDECKUNG}}";

// Screenshots live in docs/handbuch/img/ and are produced on demand by
// `npm run docs:screenshots`, so they may legitimately be absent (they are not
// committed). A missing one renders as nothing rather than as a broken box;
// the names themselves are checked by `npm run docs:check`.
function screenshotDataUri(file: string): string | null {
  const path = join(process.cwd(), "docs", "handbuch", "img", file);
  if (!existsSync(path)) return null;
  try {
    const bytes = readFileSync(path);
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  if (!(await userCan(user, "help.read"))) notFound();

  const coverage = await getLegalCoverage();
  const coverageBlock = coverageMarkdown(coverage);

  const data: OverviewPdfData = {
    title: "Produktüberblick",
    subtitle:
      "Statura Labs Dynamics — Arbeitnehmerschutz und betrieblicher Umweltschutz für Österreich und Deutschland",
    version: `Rechtsbestand ${coverage.catalogVersion}`,
    generatedOn: new Date().toISOString().slice(0, 10),
    sections: OVERVIEW_SECTIONS.map((section) => ({
      title: section.title,
      blocks: markdownToPdfBlocks(
        section.markdown.replace(COVERAGE_MARKER, coverageBlock),
      ),
      imageSrc: section.screenshot
        ? screenshotDataUri(section.screenshot)
        : null,
    })),
    footer:
      "Produktüberblick · Statura Labs Dynamics · Verumsell SRL · Keine Rechtsberatung; die Zahlen zur Rechtsabdeckung stammen aus dem aktiven Rechtsbestand dieser Installation.",
  };

  const buffer = await renderToBuffer(
    createElement(ProductOverviewDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="statura-produktueberblick.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
