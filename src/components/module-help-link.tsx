import Link from "next/link";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import type { PlatformRole } from "@/generated/prisma/enums";
import { chapterForModule } from "@/lib/handbook/chapters";
import type { ModuleKey } from "@/lib/modules/registry";

// P18 B.1: "deep links from each module page (Hilfe zu diesem Modul)".
//
// A server component, so a page adds one line and gets nothing at all when no
// chapter documents that module yet — rather than a link into a 404. The
// chapter is resolved through the same role filter the Hilfe pages use, so a
// reader is never offered a chapter they may not open.
export function ModuleHelpLink({
  module,
  role,
  siteId,
  label,
}: {
  module: ModuleKey;
  role: PlatformRole;
  siteId: string;
  label: string;
}) {
  const chapter = chapterForModule(HANDBOOK_CHAPTERS, module, role);
  if (!chapter) return null;
  return (
    <Link
      href={`/app/s/${siteId}/help/${chapter.slug}`}
      className="text-sm text-accent hover:underline"
    >
      {label}
    </Link>
  );
}
