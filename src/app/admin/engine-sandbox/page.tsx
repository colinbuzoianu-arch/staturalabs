import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { computeAteMix } from "@/lib/chemicals/engines/clp-mixture";
import { suggestLagerklasse } from "@/lib/chemicals/engines/lagerklasse-suggestion";
import {
  estimateBoilingRangeLowerBound,
  estimateFlashPoint,
  estimateMixtureDensity,
  type MixtureComponent,
} from "@/lib/chemicals/engines/physical-estimates";
import { lookupUnEntry } from "@/lib/chemicals/engines/transport-classification";
import { computeMixtureWgk } from "@/lib/chemicals/engines/wgk-mixture";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";

type SandboxInput = {
  components?: {
    name?: string;
    concentrationPct?: number;
    ate?: number | null;
    density?: number | null;
    flashPoint?: number | null;
    boilingPoint?: number | null;
    wgk?: 1 | 2 | 3 | null;
  }[];
  hCodes?: string[];
  unNumber?: string | null;
};

// P16 §4: super-admin engine sandbox — paste a composition, run all six prepared
// engines on it (no tenant data). Preview only; nothing is validated.
export default async function EngineSandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ input?: string }>;
}) {
  await requireSuperAdmin();
  const dict = getAdminDictionary(await getLocale()).engineSandboxPage;
  const { input } = await searchParams;

  let parsed: SandboxInput | null = null;
  let parseError = false;
  if (input) {
    try {
      parsed = JSON.parse(input) as SandboxInput;
    } catch {
      parseError = true;
    }
  }

  const results: { key: string; value: string }[] = [];
  if (parsed) {
    const comps = parsed.components ?? [];
    const physComps: MixtureComponent[] = comps.map((c) => ({
      name: c.name,
      massFraction: (c.concentrationPct ?? 0) / 100,
      density: c.density ?? null,
      flashPoint: c.flashPoint ?? null,
      boilingPoint: c.boilingPoint ?? null,
    }));
    const ate = computeAteMix(
      comps.map((c) => ({
        concentrationPct: c.concentrationPct ?? 0,
        ate: c.ate ?? null,
      })),
    );
    const density = estimateMixtureDensity(physComps);
    const boiling = estimateBoilingRangeLowerBound(physComps);
    const flash = estimateFlashPoint(physComps);
    const wgk = computeMixtureWgk(
      comps.map((c) => ({
        concentrationPct: c.concentrationPct ?? 0,
        wgk: c.wgk ?? null,
      })),
      null,
    );
    const lager = suggestLagerklasse(
      { hCodes: parsed.hCodes ?? [], pictograms: [] },
      [],
    );
    const un = parsed.unNumber ? lookupUnEntry(parsed.unNumber) : null;
    const show = (v: unknown) =>
      v == null
        ? dict.unavailable
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
    results.push({
      key: "CLP ATE-mix",
      value: ate.value ? show(ate.value.ateMix) : dict.unavailable,
    });
    results.push({
      key: "Density",
      value:
        density.value != null
          ? `${density.value.toFixed(3)} g/cm³`
          : dict.unavailable,
    });
    results.push({
      key: "Boiling (lower bound)",
      value: boiling.value != null ? `${boiling.value} °C` : dict.unavailable,
    });
    results.push({
      key: "Flash point",
      value: flash.value != null ? `${flash.value} °C` : dict.unavailable,
    });
    results.push({
      key: "WGK mixture",
      value:
        wgk.value != null
          ? String(wgk.value)
          : `${dict.unavailable} (${wgk.unavailableReason ?? ""})`,
    });
    results.push({
      key: "Lagerklasse",
      value:
        lager.value != null
          ? lager.value
          : `${dict.unavailable} (${lager.unavailableReason ?? ""})`,
    });
    results.push({
      key: "Transport (UN)",
      value: un?.value ? show(un.value) : dict.unavailable,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{dict.heading}</h1>
        <p className="mt-1 text-xs text-gray-500">{dict.intro}</p>
      </div>
      <form method="get" className="flex flex-col gap-2">
        <label className="text-xs text-gray-600">{dict.inputLabel}</label>
        <textarea
          name="input"
          rows={6}
          defaultValue={input ?? dict.shape}
          className="w-full rounded border px-2 py-1 font-mono text-xs"
        />
        <button
          type="submit"
          className="self-start rounded border px-3 py-1 text-sm"
        >
          {dict.run}
        </button>
      </form>
      {parseError && <p className="text-sm text-red-700">{dict.parseError}</p>}
      {results.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold">{dict.resultsHeading}</h2>
          <table className="mt-1 w-full text-left text-xs">
            <tbody>
              {results.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-1 pr-3 font-medium">{r.key}</td>
                  <td className="py-1 font-mono">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
