import { incidentImporter } from "./importers/incident";
import { vehicleImporter } from "./importers/vehicle";
import { workforcePeriodImporter } from "./importers/workforce-period";

// P14 G3: the catalogue of importable entities. Pure (no `server-only`): the
// client import UI lists entities and renders field names/templates from here,
// the server service resolves the definition to run. Each entry names the module
// its data belongs to (for placement/permission) and the permission to run it.
// Person-safe entities only; nothing here imports into the people/health
// compartment.

export type ImportEntityKey = "workforce-period" | "incident" | "vehicle";

export type ImportEntityMeta = {
  key: ImportEntityKey;
  // i18n key suffix (settingsImport.entities.<key>).
  labelKey: ImportEntityKey;
  // Permission required to run this importer.
  permission: "reports.read" | "incidents.write" | "settings.write";
  fieldKeys: string[];
};

export const IMPORT_ENTITIES: readonly ImportEntityMeta[] = [
  {
    key: "workforce-period",
    labelKey: "workforce-period",
    permission: "reports.read",
    fieldKeys: workforcePeriodImporter.fields.map((f) => f.key),
  },
  {
    key: "incident",
    labelKey: "incident",
    permission: "incidents.write",
    fieldKeys: incidentImporter.fields.map((f) => f.key),
  },
  {
    key: "vehicle",
    labelKey: "vehicle",
    permission: "settings.write",
    fieldKeys: vehicleImporter.fields.map((f) => f.key),
  },
];

export function getImportEntityMeta(key: string): ImportEntityMeta | undefined {
  return IMPORT_ENTITIES.find((e) => e.key === key);
}
