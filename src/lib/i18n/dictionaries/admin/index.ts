import type { Locale } from "../../locale";
import { de } from "./de";
import { en } from "./en";
import { ro } from "./ro";

const dictionaries = { en, de, ro };

export function getAdminDictionary(locale: Locale) {
  return dictionaries[locale];
}
