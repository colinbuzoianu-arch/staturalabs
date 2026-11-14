// P16 §5: the prospect demo seed pack. Provisions the demo tenant with fictional
// products (real substances, real CAS/legal data) for the Gefahrstoffe prospect
// demo: a full confirmed SDS each, composition with numeric engine inputs, two
// storage locations (one deliberately incompatible pair), one approved
// Betriebsanweisung, and all engines set to PREVIEW. Mostly-agreeing results plus
// three deliberate supplier errors (flash-point vs estimate; a sensitiser above
// its limit without H317; a WGK declared too low). Idempotent, tenant-scoped.
// Fictional company/product/supplier names only; real substances are fine
// (SLD_SANDBOX_READINESS_RULES rules 5–6). Run: npm run seed:prospect
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import {
  PROSPECT_COMPANY_NAME,
  PROSPECT_STORAGE_PREFIX,
  PROSPECT_SUPPLIER,
} from "./prospect-fixture-constants.mjs";

function requireEnv(k) {
  const env = readFileSync(".env", "utf8");
  const m = env.match(new RegExp(`^${k}="?([^"\\n]+)`, "m"));
  if (!m) throw new Error(`Missing ${k}`);
  return m[1];
}

const ENGINE_KEYS = [
  "clp.mixtureCalculation",
  "mixture.physicalEstimates",
  "wgk.mixtureCalculation",
  "storage.lagerklasseSuggestion",
  "transport.classification",
  "sds.authoring",
];

// Fictional products on real substances. `error` marks a deliberate supplier slip.
const PRODUCTS = [
  {
    trade: "Reinex A60",
    site: "AT",
    storage: "Lösemittel",
    lagerklasse: "3",
    signalWord: "GEFAHR",
    pictograms: ["GHS02", "GHS07"],
    statements: ["H225", "H319", "H336"],
    sds: {
      flashPoint: "-17 °C",
      density: "0,82 g/cm³",
      boilingPoint: "57 °C",
      wgk: "1",
      lagerklasse: "3",
      unNumber: "UN1090",
      transportClass: "3",
      packingGroup: "II",
    },
    components: [
      {
        name: "Aceton",
        cas: "67-64-1",
        exact: 60,
        density: 0.79,
        flash: -17,
        boiling: 56,
        ate: 5800,
        wgk: 1,
        classification: "Flam. Liq. 2",
      },
      {
        name: "Wasser",
        cas: "7732-18-5",
        exact: 40,
        density: 1.0,
        boiling: 100,
      },
    ],
  },
  {
    trade: "Solvent-Mix S50",
    site: "AT",
    storage: "Lösemittel",
    lagerklasse: "3",
    error: "flash-point",
    signalWord: "GEFAHR",
    pictograms: ["GHS02", "GHS07"],
    statements: ["H225", "H319"],
    // DELIBERATE ERROR: SDS declares a 40 °C flash point, but the components
    // (acetone -17 °C) give a much lower estimate → physical-estimate deviation.
    sds: {
      flashPoint: "40 °C",
      density: "0,80 g/cm³",
      boilingPoint: "60 °C",
      wgk: "1",
      lagerklasse: "3",
      unNumber: "UN1090",
      transportClass: "3",
      packingGroup: "II",
    },
    components: [
      {
        name: "Aceton",
        cas: "67-64-1",
        exact: 70,
        density: 0.79,
        flash: -17,
        boiling: 56,
        ate: 5800,
        wgk: 1,
        classification: "Flam. Liq. 2",
      },
      {
        name: "Isopropanol",
        cas: "67-63-0",
        exact: 30,
        density: 0.785,
        flash: 12,
        boiling: 82,
        ate: 5000,
        wgk: 1,
        classification: "Flam. Liq. 2",
      },
    ],
  },
  {
    trade: "Härter P30",
    site: "DE",
    storage: "Reaktiv",
    lagerklasse: "8B",
    error: "sensitiser-no-h317",
    signalWord: "GEFAHR",
    pictograms: ["GHS05", "GHS07"],
    // DELIBERATE ERROR: 30 % of a Skin Sens. 1 component but H317 is omitted from
    // section 2 (flags once the CLP summation config is loaded).
    statements: ["H314", "H319"],
    sds: {
      flashPoint: "nicht anwendbar",
      density: "0,95 g/cm³",
      boilingPoint: "248 °C",
      wgk: "2",
      lagerklasse: "8B",
    },
    components: [
      {
        name: "Isophorondiamin",
        cas: "2855-13-2",
        exact: 30,
        density: 0.92,
        boiling: 247,
        wgk: 2,
        classification: "Skin Corr. 1B, Skin Sens. 1",
      },
      {
        name: "Benzylalkohol",
        cas: "100-51-6",
        exact: 20,
        density: 1.04,
        boiling: 205,
        wgk: 1,
        classification: "Acute Tox. 4",
      },
    ],
  },
  {
    trade: "Kühlfluid K2",
    site: "DE",
    storage: "Reaktiv",
    lagerklasse: "10",
    error: "wgk-too-low",
    signalWord: "ACHTUNG",
    pictograms: ["GHS07"],
    // DELIBERATE ERROR: SDS declares WGK 1, but the components are WGK 2 (flags
    // once the AwSV mixture config is loaded).
    statements: ["H319"],
    sds: {
      flashPoint: "nicht anwendbar",
      density: "1,10 g/cm³",
      boilingPoint: "160 °C",
      wgk: "1",
      lagerklasse: "10",
    },
    components: [
      {
        name: "Monoethylenglykol",
        cas: "107-21-1",
        exact: 50,
        density: 1.11,
        boiling: 197,
        wgk: 1,
        classification: "Acute Tox. 4",
      },
      {
        name: "Diethanolamin",
        cas: "111-42-2",
        exact: 10,
        density: 1.09,
        boiling: 268,
        wgk: 2,
        classification: "Eye Irrit. 2",
      },
    ],
  },
  {
    trade: "Verdünner V100",
    site: "AT",
    storage: "Lösemittel",
    lagerklasse: "3",
    signalWord: "GEFAHR",
    pictograms: ["GHS02", "GHS07", "GHS08"],
    statements: ["H226", "H304", "H315", "H336"],
    sds: {
      flashPoint: "25 °C",
      density: "0,87 g/cm³",
      boilingPoint: "138 °C",
      wgk: "2",
      lagerklasse: "3",
      unNumber: "UN1307",
      transportClass: "3",
      packingGroup: "III",
    },
    components: [
      {
        name: "Xylol (Isomerengemisch)",
        cas: "1330-20-7",
        exact: 90,
        density: 0.86,
        flash: 27,
        boiling: 138,
        ate: 4300,
        wgk: 2,
        classification: "Flam. Liq. 3, Asp. Tox. 1",
      },
      {
        name: "Ethylbenzol",
        cas: "100-41-4",
        exact: 10,
        density: 0.867,
        flash: 18,
        boiling: 136,
        ate: 3500,
        wgk: 2,
        classification: "Flam. Liq. 2",
      },
    ],
  },
  {
    trade: "Netzmittel N10",
    site: "DE",
    storage: "Reaktiv",
    lagerklasse: "8B",
    signalWord: "ACHTUNG",
    pictograms: ["GHS07"],
    statements: ["H315", "H319"],
    sds: {
      flashPoint: "nicht anwendbar",
      density: "1,02 g/cm³",
      boilingPoint: "> 100 °C",
      wgk: "1",
      lagerklasse: "8B",
    },
    components: [
      {
        name: "Wasser",
        cas: "7732-18-5",
        exact: 80,
        density: 1.0,
        boiling: 100,
      },
      {
        name: "Natriumlaurylsulfat",
        cas: "151-21-3",
        exact: 20,
        wgk: 1,
        classification: "Skin Irrit. 2, Eye Dam. 1",
      },
    ],
  },
];

const SECTION_TEXT = {
  s4: "Nach Einatmen an die frische Luft bringen; bei Beschwerden Arzt hinzuziehen. Bei Augenkontakt mit Wasser spülen.",
  s5: "Geeignete Löschmittel: Schaum, CO₂, Löschpulver. Kein Vollstrahl. Behälter kühlen.",
  s6: "Zündquellen entfernen, für Belüftung sorgen, mit saugfähigem Material aufnehmen.",
  s7: "Von Zündquellen fernhalten, nicht rauchen. Kühl und gut belüftet lagern, Behälter dicht geschlossen.",
  s13: "Abfälle gemäß behördlichen Vorschriften entsorgen. Nicht in die Kanalisation gelangen lassen.",
};

function confirmedData(p) {
  return {
    productIdentifier: p.trade,
    ufi: null,
    supplier: PROSPECT_SUPPLIER,
    emergencyPhone: "+43 1 406 43 43",
    revisionDate: "2024-06-01",
    version: "1.0",
    language: "de",
    classification: p.components
      .map((c) => c.classification)
      .filter(Boolean)
      .join("; "),
    signalWord: p.signalWord === "GEFAHR" ? "Gefahr" : "Achtung",
    pictograms: p.pictograms,
    statementCodes: p.statements,
    components: p.components.map((c) => ({
      name: c.name,
      casNumber: c.cas ?? null,
      ecNumber: null,
      concentration: `${c.exact} %`,
      classification: c.classification ?? null,
      specificConcentrationLimits: null,
      mFactor: null,
      acuteToxicityEstimate: c.ate ? String(c.ate) : null,
    })),
    citedLimits: [],
    flashPoint: p.sds.flashPoint,
    boilingPoint: p.sds.boilingPoint,
    density: p.sds.density,
    vapourPressure: null,
    ph: null,
    physicalState: "flüssig",
    unNumber: p.sds.unNumber ?? null,
    properShippingName: null,
    transportClass: p.sds.transportClass ?? null,
    packingGroup: p.sds.packingGroup ?? null,
    adrRid: null,
    imdg: null,
    iata: null,
    marinePollutant: null,
    wgk: p.sds.wgk,
    lagerklasse: p.sds.lagerklasse,
    section4FirstAid: SECTION_TEXT.s4,
    section5FireFighting: SECTION_TEXT.s5,
    section6AccidentalRelease: SECTION_TEXT.s6,
    section7HandlingStorage: SECTION_TEXT.s7,
    section13Disposal: SECTION_TEXT.s13,
    rPhrases: [],
    sPhrases: [],
  };
}

async function selectOrInsert(db, table, where, insert) {
  const keys = Object.keys(where);
  const params = [];
  const cond = keys.map((k) => {
    params.push(where[k]);
    return `"${k}" = $${params.length}`;
  });
  const ex = await db.query(
    `SELECT * FROM "${table}" WHERE ${cond.join(" AND ")} LIMIT 1`,
    params,
  );
  if (ex.rows.length) return { row: ex.rows[0], created: false };
  const cols = Object.keys(insert);
  const r = await db.query(
    `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
    Object.values(insert),
  );
  return { row: r.rows[0], created: true };
}

async function main() {
  const db = new pg.Client({ connectionString: requireEnv("DIRECT_URL") });
  await db.connect();
  try {
    const co = await db.query(
      `SELECT id FROM "Company" WHERE name = $1 LIMIT 1`,
      [PROSPECT_COMPANY_NAME],
    );
    if (!co.rows.length)
      throw new Error(
        `Prospect/demo company not found: ${PROSPECT_COMPANY_NAME}. Run seed:demo first.`,
      );
    const companyId = co.rows[0].id;
    const user = await db.query(
      `SELECT id FROM "PlatformUser" WHERE "companyId" = $1 LIMIT 1`,
      [companyId],
    );
    const userId = user.rows[0]?.id ?? null;
    const sites = await db.query(
      `SELECT id, country FROM "Site" WHERE "companyId" = $1`,
      [companyId],
    );
    const siteAt = sites.rows.find((s) => s.country === "AT")?.id;
    const siteDe = sites.rows.find((s) => s.country === "DE")?.id;
    const orgUnit = await db.query(
      `SELECT id FROM "OrgUnit" WHERE "siteId" = ANY($1) LIMIT 1`,
      [sites.rows.map((s) => s.id)],
    );
    const orgUnitId = orgUnit.rows[0]?.id ?? null;

    // Engines → PREVIEW for the demo tenant (§2).
    for (const key of ENGINE_KEYS) {
      await selectOrInsert(
        db,
        "EngineFlagSetting",
        { engineKey: key, companyId },
        {
          id: crypto.randomUUID(),
          engineKey: key,
          companyId,
          state: "PREVIEW",
          setByUserId: userId,
          updatedAt: new Date(),
        },
      );
    }

    // Storage locations.
    const storageIds = {};
    for (const [name, country] of [
      ["Lösemittel", "AT"],
      ["Reaktiv", "DE"],
    ]) {
      const siteId = country === "AT" ? siteAt : siteDe;
      if (!siteId) continue;
      const { row } = await selectOrInsert(
        db,
        "StorageLocation",
        { siteId, name: `${PROSPECT_STORAGE_PREFIX} ${name}` },
        {
          id: crypto.randomUUID(),
          siteId,
          name: `${PROSPECT_STORAGE_PREFIX} ${name}`,
          type: name === "Lösemittel" ? "ROOM" : "CABINET",
          createdAt: new Date(),
        },
      );
      storageIds[name] = row.id;
    }

    let n = 0;
    for (const p of PRODUCTS) {
      const siteId = p.site === "AT" ? siteAt : siteDe;
      const { row: sub, created } = await selectOrInsert(
        db,
        "Substance",
        { companyId, tradeName: p.trade },
        {
          id: crypto.randomUUID(),
          companyId,
          tradeName: p.trade,
          manufacturer: PROSPECT_SUPPLIER,
          physicalState: "LIQUID",
          signalWord: p.signalWord,
          carcinogenicCategory: "NONE",
          mutagenicCategory: "NONE",
          reprotoxicCategory: "NONE",
          lagerklasse: p.sds.lagerklasse,
          wgk: p.sds.wgk,
          updatedAt: new Date(),
        },
      );
      if (!created) {
        n++;
        continue;
      } // idempotent: product already seeded

      for (const pic of p.pictograms)
        await db.query(
          `INSERT INTO "SubstancePictogram"(id,"substanceId",pictogram) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), sub.id, pic],
        );
      for (const code of p.statements) {
        const kind = code.startsWith("EUH")
          ? "EUH"
          : code.startsWith("P")
            ? "P"
            : "H";
        await db.query(
          `INSERT INTO "SubstanceStatement"(id,"substanceId",kind,code) VALUES ($1,$2,$3,$4)`,
          [crypto.randomUUID(), sub.id, kind, code],
        );
      }
      const sdsId = crypto.randomUUID();
      await db.query(
        `INSERT INTO "SafetyDataSheet"(id,"substanceId",version,"revisionDate",language,supplier,"confirmedData","extractionMethod","confirmedByUserId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          sdsId,
          sub.id,
          "1.0",
          new Date("2024-06-01"),
          "de",
          PROSPECT_SUPPLIER,
          JSON.stringify(confirmedData(p)),
          "manual",
          userId,
        ],
      );
      for (const c of p.components) {
        await db.query(
          `INSERT INTO "SdsComponent"(id,"safetyDataSheetId",name,"casNumber",concentration,classification) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            crypto.randomUUID(),
            sdsId,
            c.name,
            c.cas ?? null,
            `${c.exact} %`,
            c.classification ?? null,
          ],
        );
        await db.query(
          `INSERT INTO "MixtureComponent"(id,"substanceId","casNumber",name,"concentrationExactPct",classification,"ateOral","wgk","densityGCm3","flashPointC","boilingPointC",source,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            crypto.randomUUID(),
            sub.id,
            c.cas ?? null,
            c.name,
            c.exact,
            c.classification ?? null,
            c.ate ?? null,
            c.wgk ?? null,
            c.density ?? null,
            c.flash ?? null,
            c.boiling ?? null,
            "MANUAL",
            new Date(),
          ],
        );
      }
      // one use at the product's site + storage location
      if (siteId && orgUnitId) {
        await db.query(
          `INSERT INTO "SubstanceUse"(id,"substanceId","siteId","orgUnitId",purpose,"quantityClass","storageLocationId","activeFrom") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            crypto.randomUUID(),
            sub.id,
            siteId,
            orgUnitId,
            "Demo-Verwendung",
            "M",
            storageIds[p.storage] ?? null,
            new Date(),
          ],
        );
      }
      n++;
    }

    // One approved Betriebsanweisung for the first prospect product (at AT).
    const first = await db.query(
      `SELECT id FROM "Substance" WHERE "companyId"=$1 AND "tradeName"=$2 LIMIT 1`,
      [companyId, PRODUCTS[0].trade],
    );
    if (first.rows.length && siteAt) {
      await selectOrInsert(
        db,
        "OperatingInstruction",
        { substanceId: first.rows[0].id, siteId: siteAt },
        {
          id: crypto.randomUUID(),
          substanceId: first.rows[0].id,
          siteId: siteAt,
          status: "APPROVED",
          approvedByUserId: userId,
          approvedAt: new Date(),
          basedOnSdsRevisionDate: new Date("2024-06-01"),
          updatedAt: new Date(),
        },
      );
    }

    console.log(
      `seed:prospect done — ${n} products, engines PREVIEW, storage + BA on ${PROSPECT_COMPANY_NAME}`,
    );
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
