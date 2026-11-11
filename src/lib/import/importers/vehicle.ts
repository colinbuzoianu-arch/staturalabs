import type { ImporterDefinition, ImportFieldSpec } from "../framework";

// P14 G4: fleet master importer (person-free — no driver column exists). Places
// each imported vehicle company-wide; site/org-unit placement is edited in the
// register afterwards. Bulk fleet onboarding via the one G3 pipeline.

export type VehicleImportValue = {
  identifier: string;
  type: string;
  notes: string | null;
};

export type VehicleImportContext = Record<string, never>;

const FIELDS: readonly ImportFieldSpec[] = [
  {
    key: "identifier",
    required: true,
    aliases: ["identifier", "kennzeichen", "plate", "kfz", "numar"],
    example: "W-12345A",
  },
  {
    key: "type",
    required: true,
    aliases: ["type", "typ", "art", "tip"],
    example: "Gabelstapler",
  },
  {
    key: "notes",
    required: false,
    aliases: ["notes", "notizen", "note"],
    example: "",
  },
];

export const vehicleImporter: ImporterDefinition<
  VehicleImportValue,
  VehicleImportContext
> = {
  entity: "vehicle",
  fields: FIELDS,
  validateRow(cells) {
    if (!cells.identifier)
      return { status: "error", reason: "missing-identifier" };
    if (!cells.type) return { status: "error", reason: "missing-vehicle-type" };
    return {
      status: "create",
      value: {
        identifier: cells.identifier,
        type: cells.type,
        notes: cells.notes || null,
      },
    };
  },
};
