import { imageSize } from "image-size";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { deleteFloorPlanFile, uploadFloorPlan } from "@/lib/storage/floor-plan";

const MAX_FLOOR_PLAN_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export default async function FloorPlansPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).floorPlansPage;

  async function uploadFloorPlanAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(await getLocale()).floorPlansPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const name = formData.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error(dict.nameRequired);
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error(dict.fileRequired);
    }
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      throw new Error(dict.invalidFileType);
    }
    if (file.size > MAX_FLOOR_PLAN_BYTES) {
      throw new Error(dict.fileTooLarge);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // imageSize (not sharp — no native deps, pure JS, ~nothing to the
    // bundle) reads just the PNG/JPEG/WEBP header to get pixel dimensions
    // without decoding the whole image. Throws on data it can't parse,
    // which doubles as a second, content-based check beyond the
    // extension/MIME check above.
    let width: number;
    let height: number;
    try {
      ({ width, height } = imageSize(buffer));
    } catch {
      throw new Error(dict.invalidImage);
    }

    try {
      const storagePath = await uploadFloorPlan(buffer, file.name, siteId);
      await prisma.floorPlan.create({
        data: { siteId, name: name.trim(), storagePath, width, height },
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/administration/sites/${siteId}/floor-plans`);
  }

  async function deleteFloorPlanAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const floorPlanId = formData.get("floorPlanId");
    if (typeof floorPlanId !== "string" || floorPlanId.length === 0) {
      throw new Error(commonDict.unexpectedError("missing floorPlanId"));
    }

    const floorPlan = await prisma.floorPlan.findUnique({
      where: { id: floorPlanId },
      select: { siteId: true, storagePath: true },
    });
    if (!floorPlan || floorPlan.siteId !== siteId) notFound();

    // DB row first, then the storage object — matches the task's ordering.
    // A failure after this point leaves an orphaned file in storage, which
    // is recoverable clutter; the reverse order risks a FloorPlan row left
    // pointing at nothing.
    await prisma.floorPlan.delete({ where: { id: floorPlanId } });

    try {
      await deleteFloorPlanFile(floorPlan.storagePath);
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/administration/sites/${siteId}/floor-plans`);
  }

  const floorPlans = await prisma.floorPlan.findMany({
    where: { siteId },
    include: {
      _count: {
        select: { workstationPlanPositions: true, taskPlanPositions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">{dict.uploadHeading}</h2>
        {/* No explicit encType: React sets it automatically for a function
            action (and a file input forces multipart/form-data regardless)
            — setting it here only trips React's dev-mode "will get
            overridden" warning. */}
        <form
          action={uploadFloorPlanAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            {dict.nameLabel}
            <input
              name="name"
              required
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.fileLabel}
            <input
              type="file"
              name="file"
              required
              accept="image/png,image/jpeg,image/webp"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
          >
            {dict.upload}
          </button>
        </form>
      </section>

      {floorPlans.length === 0 ? (
        <p className="text-sm text-border">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-4">{dict.colName}</th>
              <th className="py-1 pr-4">{dict.colDimensions}</th>
              <th className="py-1 pr-4">{dict.colWorkstationPins}</th>
              <th className="py-1 pr-4">{dict.colTaskPins}</th>
              <th className="py-1 pr-4">{dict.colCreatedAt}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {floorPlans.map((floorPlan) => (
              <tr
                key={floorPlan.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-1 pr-4">{floorPlan.name}</td>
                <td className="py-1 pr-4">
                  {floorPlan.width} × {floorPlan.height}
                </td>
                <td className="py-1 pr-4">
                  {floorPlan._count.workstationPlanPositions}
                </td>
                <td className="py-1 pr-4">
                  {floorPlan._count.taskPlanPositions}
                </td>
                <td className="py-1 pr-4">
                  {floorPlan.createdAt.toISOString()}
                </td>
                <td className="py-1 pr-4">
                  <Link
                    href={`/administration/sites/${siteId}/floor-plans/${floorPlan.id}`}
                    className="underline hover:text-accent"
                  >
                    {dict.manage}
                  </Link>
                </td>
                <td className="py-1">
                  <form action={deleteFloorPlanAction}>
                    <input
                      type="hidden"
                      name="floorPlanId"
                      value={floorPlan.id}
                    />
                    <ConfirmSubmitButton
                      confirmMessage={dict.deleteConfirm}
                      className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                    >
                      {dict.deleteButton}
                    </ConfirmSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
