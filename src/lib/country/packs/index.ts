import type { MarketingCountry } from "../countries";
import { at } from "./at";
import { ch } from "./ch";
import { de } from "./de";
import type { CountryPack } from "./types";

const PACKS: Record<MarketingCountry, CountryPack> = { at, de, ch };

// The one resolver every consumer should call — never import a
// packs/{at,de,ch}.ts file directly, so this stays the single place that
// knows the full set (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.1).
export function getCountryPack(country: MarketingCountry): CountryPack {
  return PACKS[country];
}

export type {
  CountryPack,
  CountryPackLegalReferences,
  CountryPackTerminology,
} from "./types";
