// P15 §3: shared shape for the PREPARED Phase 2/3 engines. Every one is built
// as pure logic behind a feature flag that defaults OFF (§0.2); nothing it
// produces is shown to a customer until a founder enables the flag per tenant.
// Every result therefore carries a PREPARED_ENGINE marker and a label making
// clear it is a Berechnungsvorschlag / Näherungswert requiring expert review —
// the engine never presents a value as a final classification or legal value.

export const PREPARED_ENGINE = "PREPARED_ENGINE" as const;

export type PreparedResult<T> = {
  marker: typeof PREPARED_ENGINE;
  /** The computed value, or null when the engine refuses (missing data). */
  value: T | null;
  /** Human label stating this is a proposal needing expert review. */
  label: string;
  /** Why the engine could not compute (when value is null). */
  unavailableReason?: string;
};

export function prepared<T>(
  value: T | null,
  label: string,
  unavailableReason?: string,
): PreparedResult<T> {
  return { marker: PREPARED_ENGINE, value, label, unavailableReason };
}

// The feature-flag keys for the six prepared engines (§3). Default OFF — a tenant
// sees nothing until a founder enables the key (isFeatureEnabled).
export const PREPARED_ENGINE_FLAGS = {
  clpMixtureCalculation: "clp.mixtureCalculation",
  mixturePhysicalEstimates: "mixture.physicalEstimates",
  wgkMixtureCalculation: "wgk.mixtureCalculation",
  transportClassification: "transport.classification",
  sdsAuthoring: "sds.authoring",
  storageLagerklasseSuggestion: "storage.lagerklasseSuggestion",
} as const;

export const BERECHNUNGSVORSCHLAG_DE =
  "Berechnungsvorschlag — Prüfung durch Fachkundige erforderlich";
export const NAEHERUNGSWERT_DE = "Näherungswert, nicht für Einstufung";
