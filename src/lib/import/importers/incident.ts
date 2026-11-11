import { IncidentType } from "@/generated/prisma/enums";
import type { ImporterDefinition, ImportFieldSpec } from "../framework";

// P14 G3: incident importer — person-safe. Creates person-free Incident rows
// (narrative + metadata) only; involved persons and health details (the people
// / health compartments, §3.18) are NEVER imported here. A historical-incident
// bulk upload that would carry names is a compartment violation by construction,
// so the importer has no person fields to map.

export type IncidentImportValue = {
  type: IncidentType;
  title: string;
  description: string;
  occurredAt: Date;
  // Optional subject references resolved by name within the site.
  subjectWorkstationId: string | null;
  subjectOrgUnitId: string | null;
  // P14 G4: optional fleet-vehicle link (by identifier) for a Fahrzeugereignis.
  vehicleId: string | null;
};

export type IncidentImportContext = {
  workstationIdByName: Map<string, string>;
  orgUnitIdByName: Map<string, string>;
  // Company-scoped: active vehicle identifier (lower-cased) -> id.
  vehicleIdByIdentifier: Map<string, string>;
};

const FIELDS: readonly ImportFieldSpec[] = [
  {
    key: "type",
    required: true,
    aliases: ["type", "typ", "art", "tip"],
    example: "ARBEITSUNFALL",
  },
  {
    key: "title",
    required: true,
    aliases: ["title", "titel", "betreff", "titlu"],
    example: "Sturz auf Treppe",
  },
  {
    key: "description",
    required: true,
    aliases: ["description", "beschreibung", "hergang", "descriere"],
    example: "Kurze, personenfreie Beschreibung",
  },
  {
    key: "occurredAt",
    required: true,
    aliases: ["date", "datum", "occurredat", "ereignisdatum", "data"],
    example: "2026-03-14",
  },
  {
    key: "workstation",
    required: false,
    aliases: ["workstation", "arbeitsplatz", "loc de munca"],
    example: "",
  },
  {
    key: "orgUnit",
    required: false,
    aliases: [
      "orgunit",
      "org unit",
      "organisationseinheit",
      "abteilung",
      "unitate",
    ],
    example: "",
  },
  {
    key: "vehicle",
    required: false,
    aliases: ["vehicle", "fahrzeug", "kennzeichen", "vehicul"],
    example: "",
  },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = new Set<string>(Object.values(IncidentType));

export const incidentImporter: ImporterDefinition<
  IncidentImportValue,
  IncidentImportContext
> = {
  entity: "incident",
  fields: FIELDS,
  validateRow(cells, ctx) {
    const type = cells.type.trim().toUpperCase();
    if (!VALID_TYPES.has(type))
      return { status: "error", reason: "invalid-type" };
    if (!cells.title) return { status: "error", reason: "missing-title" };
    if (!cells.description)
      return { status: "error", reason: "missing-description" };
    if (!ISO_DATE.test(cells.occurredAt))
      return { status: "error", reason: "invalid-date" };
    const occurredAt = new Date(`${cells.occurredAt}T00:00:00.000Z`);
    if (Number.isNaN(occurredAt.getTime()))
      return { status: "error", reason: "invalid-date" };

    let subjectWorkstationId: string | null = null;
    if (cells.workstation) {
      const id = ctx.workstationIdByName.get(cells.workstation.toLowerCase());
      if (!id) return { status: "error", reason: "unknown-workstation" };
      subjectWorkstationId = id;
    }
    let subjectOrgUnitId: string | null = null;
    if (cells.orgUnit) {
      const id = ctx.orgUnitIdByName.get(cells.orgUnit.toLowerCase());
      if (!id) return { status: "error", reason: "unknown-org-unit" };
      subjectOrgUnitId = id;
    }
    let vehicleId: string | null = null;
    if (cells.vehicle) {
      const id = ctx.vehicleIdByIdentifier.get(cells.vehicle.toLowerCase());
      if (!id) return { status: "error", reason: "unknown-vehicle" };
      vehicleId = id;
    }

    return {
      status: "create",
      value: {
        type: type as IncidentType,
        title: cells.title,
        description: cells.description,
        occurredAt,
        subjectWorkstationId,
        subjectOrgUnitId,
        vehicleId,
      },
    };
  },
};
