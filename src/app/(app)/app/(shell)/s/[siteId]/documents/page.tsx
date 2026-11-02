import { redirect } from "next/navigation";

// Dokumente module landing → the generated-documents archive (the only
// documents surface built so far; the uploads/library half is a later pass).
export default async function DocumentsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/documents/generated`);
}
