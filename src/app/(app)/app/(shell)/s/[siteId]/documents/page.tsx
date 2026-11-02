import { redirect } from "next/navigation";

// Dokumente module landing → the uploads library (its primary surface; the
// generated-document archive is the second tab).
export default async function DocumentsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/documents/library`);
}
