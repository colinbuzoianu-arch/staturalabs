import { revalidatePath } from "next/cache";
import type { EngineFlagState } from "@/generated/prisma/enums";
import { setFeatureFlag } from "@/lib/admin/feature-flags";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import {
  hasCurrentEngineReview,
  resolveEngineFlagState,
  setEngineFlagState,
} from "@/lib/chemicals/engines/engine-flags";
import { ENGINE_KEYS } from "@/lib/chemicals/engines/prepared";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const ENGINE_STATES: EngineFlagState[] = ["OFF", "PREVIEW", "VALIDATED"];

// P13 §2.5: super-admin feature flags (global or per tenant).
export default async function FlagsPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).flagsPage;

  async function setFlagAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const key = formData.get("key");
    const companyId = formData.get("companyId");
    const enabled = formData.get("enabled") === "on";
    if (typeof key !== "string") return;
    await setFeatureFlag({
      key,
      companyId:
        typeof companyId === "string" && companyId.length > 0
          ? companyId
          : null,
      enabled,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/flags");
  }

  async function setEngineAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const engineKey = formData.get("engineKey");
    const companyId = formData.get("companyId");
    const state = formData.get("state");
    if (typeof engineKey !== "string" || typeof companyId !== "string") return;
    if (state !== "OFF" && state !== "PREVIEW" && state !== "VALIDATED") return;
    try {
      await setEngineFlagState({
        engineKey,
        companyId,
        state,
        actorUserId: actor.id,
      });
    } catch {
      // VALIDATED without a review (or unknown key) — ignored; the UI disables the
      // option, and the guard is the real gate.
    }
    revalidatePath("/admin/flags");
  }

  const [flags, companies] = await Promise.all([
    prisma.featureFlag.findMany({
      orderBy: [{ key: "asc" }, { companyId: "asc" }],
    }),
    prisma.company.findMany({ select: { id: true, name: true } }),
  ]);
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  // Engine flags (§2): resolved three-state per company × engine, plus whether a
  // review exists per engine (gates VALIDATED).
  const engineReview = new Map(
    await Promise.all(
      ENGINE_KEYS.map(
        async (k) => [k, await hasCurrentEngineReview(k)] as const,
      ),
    ),
  );
  const engineRows = await Promise.all(
    companies.flatMap((c) =>
      ENGINE_KEYS.map(async (k) => ({
        companyId: c.id,
        companyName: c.name,
        engineKey: k,
        state: await resolveEngineFlagState(k, c.id),
      })),
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{dict.heading}</h1>
        <p className="mt-1 text-xs text-gray-500">{dict.intro}</p>
      </div>

      <form
        action={setFlagAction}
        className="flex flex-wrap items-end gap-2 text-xs"
      >
        <label className="flex flex-col">
          {dict.keyLabel}
          <input name="key" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col">
          {dict.scopeLabel}
          <select name="companyId" className="rounded border px-2 py-1">
            <option value="">{dict.globalScope}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="enabled" /> {dict.enabledLabel}
        </label>
        <button type="submit" className="rounded border px-3 py-1">
          {dict.setFlag}
        </button>
      </form>

      {flags.length === 0 ? (
        <p className="text-sm">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3">{dict.colKey}</th>
              <th className="py-1 pr-3">{dict.colScope}</th>
              <th className="py-1 pr-3">{dict.colEnabled}</th>
              <th className="py-1">{dict.colSetAt}</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="py-1 pr-3 font-mono">{f.key}</td>
                <td className="py-1 pr-3">
                  {f.companyId
                    ? (companyName.get(f.companyId) ?? f.companyId.slice(0, 8))
                    : dict.globalScope}
                </td>
                <td className="py-1 pr-3">{f.enabled ? dict.on : dict.off}</td>
                <td className="py-1">
                  {f.updatedAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-6">
        <h2 className="text-lg font-semibold">{dict.enginesHeading}</h2>
        <p className="mt-1 text-xs text-gray-500">{dict.enginesIntro}</p>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3">{dict.colScope}</th>
              <th className="py-1 pr-3">{dict.colEngine}</th>
              <th className="py-1 pr-3">{dict.colReview}</th>
              <th className="py-1">{dict.colState}</th>
            </tr>
          </thead>
          <tbody>
            {engineRows.map((r) => {
              const reviewed = engineReview.get(r.engineKey) ?? false;
              return (
                <tr
                  key={`${r.companyId}:${r.engineKey}`}
                  className="border-b last:border-0"
                >
                  <td className="py-1 pr-3">{r.companyName}</td>
                  <td className="py-1 pr-3">
                    {dict.engineLabels[
                      r.engineKey as keyof typeof dict.engineLabels
                    ] ?? r.engineKey}
                  </td>
                  <td className="py-1 pr-3">
                    {reviewed ? dict.reviewYes : dict.reviewNo}
                  </td>
                  <td className="py-1">
                    <form
                      action={setEngineAction}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="hidden"
                        name="engineKey"
                        value={r.engineKey}
                      />
                      <input
                        type="hidden"
                        name="companyId"
                        value={r.companyId}
                      />
                      <select
                        name="state"
                        defaultValue={r.state}
                        className="rounded border px-1 py-0.5"
                      >
                        {ENGINE_STATES.map((s) => (
                          <option
                            key={s}
                            value={s}
                            disabled={s === "VALIDATED" && !reviewed}
                          >
                            {s === "OFF"
                              ? dict.stateOff
                              : s === "PREVIEW"
                                ? dict.statePreview
                                : dict.stateValidated}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded border px-2 py-0.5"
                      >
                        {dict.saveState}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-gray-400">
          {dict.validatedNeedsReview}
        </p>
      </div>
    </div>
  );
}
