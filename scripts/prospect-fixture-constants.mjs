// Shared by seed-prospect-fixture.mjs and reset-prospect-fixture.mjs (P16 §5).
// The prospect demo pack provisions the existing demo tenant with fictional
// products built on REAL substances, for the founder's prospecting demo. A
// marker (the fictional supplier name) distinguishes prospect products so reset
// can remove exactly them. Reset refuses unless the demo company is found.
import { DEMO_COMPANY_NAME } from "./demo-fixture-constants.mjs";

export const PROSPECT_COMPANY_NAME = DEMO_COMPANY_NAME;
// Marker on every prospect product (manufacturer + SDS supplier) — no real brand.
export const PROSPECT_SUPPLIER = "Demo-Lieferant (fiktiv)";
export const PROSPECT_STORAGE_PREFIX = "Demo-Lager";
