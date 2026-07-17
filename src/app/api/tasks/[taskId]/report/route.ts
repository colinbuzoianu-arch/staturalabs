import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { requireTaskAccess } from "@/lib/auth/require-access";
import { getTaskReportData } from "@/lib/report/get-task-report-data";
import { TaskReportDocument } from "@/lib/report/TaskReportDocument";

// Plain .ts, not .tsx: Next.js Route Handlers return a Response, never
// JSX, so the PDF document element is built with createElement rather than
// a JSX literal — avoids the (unsupported) question of whether route.tsx
// is even a recognized special-file extension.
//
// Auth: requireTaskAccess (src/lib/auth/require-access.ts) — the exact same
// wrapper every dashboard page uses, no new authorization logic. Both
// redirect() (unauthenticated -> /login) and notFound() (task doesn't
// exist, or exists but this user can't see it -> 404) work inside Route
// Handlers the same as in Server Components, and read naturally here since
// "Download report" is a plain browser-navigated link, not a fetch() call.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const { task } = await requireTaskAccess(taskId);

  const data = await getTaskReportData(task);
  // react-pdf's renderToBuffer types its param as ReactElement<DocumentProps>
  // specifically (i.e. a <Document> element), not any component that
  // happens to render one — TaskReportDocument does the latter, so the
  // element is cast to whatever renderToBuffer actually expects rather
  // than duplicating that type here.
  const buffer = await renderToBuffer(
    createElement(TaskReportDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const safeWorkstationName = task.workstation.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `statura-report-${safeWorkstationName || "workstation"}-${task.id}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
