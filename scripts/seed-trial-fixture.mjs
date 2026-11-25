// P18 A.2: the starting data for a prospect trial ("Mit Demo-Daten").
//
// Seeds ONE existing, empty trial company with a compact but genuinely usable
// fixture: an org tree, four workstations with tasks, a complete approved
// Evaluierung plus a deliberately incomplete draft, two corrective actions,
// three fictional people with assignments, an instruction requirement, two
// substances with SDS and one Betriebsanweisung, an inspection template with a
// planned walk-through, one near miss, workforce figures and a published
// safety information. Dates are relative to TODAY, so a trial always looks
// current.
//
// Deliberately NOT the demo fixture: seed-demo-fixture.mjs is keyed to one
// company name, creates auth users and carries the whole prospect chemistry
// pack. This one targets a company by id, creates no accounts (the trial admin
// is invited through the normal invite flow) and is safe to run against a
// freshly created tenant.
//
// Fictional company/product/person names only; real substances and real legal
// references are fine (SLD_SANDBOX_READINESS_RULES rules 5–6).
//
// Usage: node scripts/seed-trial-fixture.mjs --company-id <id> --country AT|DE
//        (also reachable as `npm run seed:trial -- --company-id ... --country ...`)
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function requireEnv(key) {
  if (process.env[key]) return process.env[key];
  const env = readFileSync(".env", "utf8");
  const m = env.match(new RegExp(`^${key}="?([^"\\n]+)`, "m"));
  if (!m) throw new Error(`Missing ${key}`);
  return m[1];
}

const COMPANY_ID = arg("company-id");
const COUNTRY = (arg("country", "AT") ?? "AT").toUpperCase();
// RiskAssessment.assessorUserId / approvedByUserId are NOT NULL (plain uuids,
// no FK). The caller passes the tenant's OWN first administrator, so the sample
// Evaluierung reads as the prospect's own work rather than as nobody's — which
// is also why createTrial invites the contact before it seeds.
const ASSESSOR = arg("assessor");
if (!COMPANY_ID) {
  console.error(
    "Usage: node scripts/seed-trial-fixture.mjs --company-id <id> [--country AT|DE]",
  );
  process.exit(1);
}
if (!ASSESSOR) {
  console.error(
    "Missing --assessor <platformUserId> (the tenant's first administrator)",
  );
  process.exit(1);
}
if (!["AT", "DE"].includes(COUNTRY)) {
  // CH stays off (P18 A.2) — its country pack is not verified.
  console.error(`Unsupported trial country: ${COUNTRY} (AT or DE)`);
  process.exit(1);
}

// Every row this script writes carries the marker, so a reset can find them and
// a human can tell trial data from anything a prospect typed themselves.
const TRIAL_MARKER = "TESTZUGANG — Beispieldaten";

const days = (n) => new Date(Date.now() + n * 86400000);

async function selectOrInsert(db, table, whereCols, insertCols) {
  const keys = Object.keys(whereCols);
  const params = [];
  const conditions = keys.map((k) => {
    const v = whereCols[k];
    if (v === null) return `"${k}" IS NULL`;
    params.push(v);
    return `"${k}" = $${params.length}`;
  });
  const existing = await db.query(
    `SELECT * FROM "${table}" WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params,
  );
  if (existing.rows.length > 0) return existing.rows[0];
  const cols = Object.keys(insertCols);
  const inserted = await db.query(
    `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    Object.values(insertCols),
  );
  return inserted.rows[0];
}

async function insertRow(db, table, insertCols) {
  const cols = Object.keys(insertCols);
  const inserted = await db.query(
    `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    Object.values(insertCols),
  );
  return inserted.rows[0];
}

const ALL_HAZARD_CATEGORIES = [
  "PHYSICAL_MECHANICAL",
  "NOISE",
  "VIBRATION",
  "LIGHTING",
  "CLIMATE_THERMAL",
  "CHEMICAL",
  "DUST_PARTICULATE",
  "BIOLOGICAL",
  "ERGONOMIC_MSD",
  "PSYCHOSOCIAL",
  "ELECTRICAL",
  "FIRE_EXPLOSION",
  "RADIATION",
];
const NO_HAZARD_RATIONALE =
  "Im Rahmen der Begehung geprüft — keine relevante Gefährdung dieser Kategorie festgestellt.";

async function main() {
  const db = new pg.Client({ connectionString: requireEnv("DIRECT_URL") });
  await db.connect();
  try {
    const company = (
      await db.query(
        `SELECT id, name, "tenantKind" FROM "Company" WHERE id = $1`,
        [COMPANY_ID],
      )
    ).rows[0];
    if (!company) throw new Error(`No company with id ${COMPANY_ID}`);
    // Guard: this script writes fictional data. It must never run against a
    // real customer tenant by a mistyped id.
    if (company.tenantKind !== "TRIAL") {
      throw new Error(
        `Refusing to seed ${company.name}: tenantKind is ${company.tenantKind}, not TRIAL`,
      );
    }
    console.log(`Seeding trial data for ${company.name} (${COUNTRY})`);

    const site = await selectOrInsert(
      db,
      "Site",
      { companyId: company.id, name: `${company.name} — Werk 1` },
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        name: `${company.name} — Werk 1`,
        address:
          COUNTRY === "AT"
            ? "Beispielstraße 1, 1100 Wien"
            : "Beispielweg 1, 80331 München",
        country: COUNTRY,
        employeeCount: 48,
        updatedAt: new Date(),
      },
    );

    // --- Org tree: plant → three departments.
    const plant = await selectOrInsert(
      db,
      "OrgUnit",
      { siteId: site.id, name: "Werk 1", parentId: null },
      {
        id: crypto.randomUUID(),
        siteId: site.id,
        name: "Werk 1",
        type: "PLANT",
        parentId: null,
        updatedAt: new Date(),
      },
    );
    const departments = {};
    for (const name of ["Fertigung", "Lager & Versand", "Instandhaltung"]) {
      departments[name] = await selectOrInsert(
        db,
        "OrgUnit",
        { siteId: site.id, name },
        {
          id: crypto.randomUUID(),
          siteId: site.id,
          name,
          type: "DEPARTMENT",
          parentId: plant.id,
          updatedAt: new Date(),
        },
      );
    }

    // --- Workstations + tasks.
    const workstationDefs = [
      {
        name: "Montagelinie 1",
        dept: "Fertigung",
        tasks: ["Baugruppen montieren", "Sichtprüfung"],
      },
      {
        name: "Schweißplatz",
        dept: "Fertigung",
        tasks: ["Schweißen von Rahmen"],
      },
      {
        name: "Kommissionierung",
        dept: "Lager & Versand",
        tasks: ["Paletten kommissionieren"],
      },
      {
        name: "Werkstatt",
        dept: "Instandhaltung",
        tasks: ["Wartung Fördertechnik"],
      },
    ];
    const workstations = {};
    const tasks = {};
    for (const def of workstationDefs) {
      const ws = await selectOrInsert(
        db,
        "Workstation",
        { siteId: site.id, name: def.name },
        {
          id: crypto.randomUUID(),
          siteId: site.id,
          orgUnitId: departments[def.dept].id,
          name: def.name,
          updatedAt: new Date(),
        },
      );
      workstations[def.name] = ws;
      for (const taskName of def.tasks) {
        tasks[taskName] = await selectOrInsert(
          db,
          "Task",
          { workstationId: ws.id, name: taskName },
          {
            id: crypto.randomUUID(),
            workstationId: ws.id,
            name: taskName,
            updatedAt: new Date(),
          },
        );
      }
    }

    // Marker check: everything below is the all-or-nothing narrative block.
    const marker = await db.query(
      `SELECT id FROM "RiskAssessment" WHERE "siteId" = $1 AND "pilotContext" = $2 LIMIT 1`,
      [site.id, TRIAL_MARKER],
    );
    if (marker.rows.length > 0) {
      console.log("Trial narrative already seeded — skipping.");
      console.log(JSON.stringify({ companyId: company.id, siteId: site.id }));
      return;
    }

    const matrixVersion = (
      await db.query(
        `SELECT version FROM "RiskMatrixVersion" WHERE "isActive" = true LIMIT 1`,
      )
    ).rows[0]?.version;
    if (!matrixVersion) throw new Error("No active RiskMatrixVersion");

    const getCell = async (probability, severity) =>
      (
        await db.query(
          `SELECT "riskScore", "riskBand" FROM "RiskMatrixCell"
            WHERE "matrixVersion" = $1 AND probability = $2 AND severity = $3`,
          [matrixVersion, probability, severity],
        )
      ).rows[0];
    const getHazard = async (code) =>
      (
        await db.query(
          `SELECT id FROM "Hazard" WHERE code = $1 AND "companyId" IS NULL LIMIT 1`,
          [code],
        )
      ).rows[0];

    const assessedAt = days(-40);

    const createAssessment = async (workstationName, status) =>
      insertRow(db, "RiskAssessment", {
        id: crypto.randomUUID(),
        siteId: site.id,
        workstationId: workstations[workstationName].id,
        matrixVersion,
        status,
        assessorUserId: ASSESSOR,
        assessedAt,
        ...(status === "APPROVED"
          ? { approvedAt: days(-37), approvedByUserId: ASSESSOR }
          : {}),
        pilotContext: TRIAL_MARKER,
        activityType: "ROUTINE",
        personsExposedCount: 6,
        shiftPattern: "Einschichtbetrieb",
        processDescription:
          "Beispielhafte Beschreibung für den Testzugang — bitte durch eigene Angaben ersetzen.",
        reviewIntervalMonths: 12,
        nextReviewDate: days(325),
        updatedAt: new Date(),
      });

    const addFinding = async (
      assessment,
      code,
      probability,
      severity,
      controls,
    ) => {
      const hazard = await getHazard(code);
      if (!hazard) return null;
      const cell = await getCell(probability, severity);
      return insertRow(db, "RiskFinding", {
        id: crypto.randomUUID(),
        riskAssessmentId: assessment.id,
        hazardId: hazard.id,
        probability,
        severity,
        riskScore: cell.riskScore,
        riskBand: cell.riskBand,
        existingControls: controls,
        updatedAt: new Date(),
      });
    };

    const addCategoryChecks = async (
      assessment,
      { present = [], open = [] },
    ) => {
      for (const category of ALL_HAZARD_CATEGORIES) {
        const status = present.includes(category)
          ? "HAZARD_PRESENT"
          : open.includes(category)
            ? "OPEN"
            : "CHECKED_NO_HAZARD";
        await insertRow(db, "HazardCategoryCheck", {
          id: crypto.randomUUID(),
          riskAssessmentId: assessment.id,
          category,
          status,
          rationale:
            status === "CHECKED_NO_HAZARD" ? NO_HAZARD_RATIONALE : null,
          checkedByUserId: status === "OPEN" ? null : ASSESSOR,
          checkedAt: status === "OPEN" ? null : assessedAt,
          updatedAt: new Date(),
        });
      }
    };

    // A complete, approved Evaluierung on the assembly line …
    const approved = await createAssessment("Montagelinie 1", "APPROVED");
    const ergoFinding = await addFinding(
      approved,
      "ERGO-01",
      4,
      3,
      "Höhenverstellbare Werkbank vorhanden, wird aber nicht konsequent genutzt.",
    );
    await addFinding(approved, "NOISE-01", 3, 3, "Gehörschutz bereitgestellt.");
    await addCategoryChecks(approved, { present: ["ERGONOMIC_MSD", "NOISE"] });

    // … and a deliberately incomplete draft on the welding bay, so the trial
    // shows what an unfinished Evaluierung looks like.
    const draft = await createAssessment("Schweißplatz", "DRAFT");
    await addFinding(
      draft,
      "FIRE-01",
      3,
      4,
      "Feuerlöscher in Reichweite; Schweißerlaubnis noch nicht geregelt.",
    );
    await addCategoryChecks(draft, {
      present: ["FIRE_EXPLOSION"],
      open: ["CHEMICAL", "DUST_PARTICULATE", "RADIATION"],
    });
    console.log("Evaluierungen: 1 freigegeben, 1 Entwurf (unvollständig)");

    // --- Two corrective actions, one open and one already implemented.
    if (ergoFinding) {
      const open = await insertRow(db, "Action", {
        id: crypto.randomUUID(),
        siteId: site.id,
        riskFindingId: ergoFinding.id,
        title: "Hebehilfe an der Montagelinie beschaffen",
        description:
          "Beschaffung und Einweisung einer Hebehilfe für Baugruppen über 15 kg.",
        hierarchyOfControl: "ENGINEERING_CONTROL",
        responsibleRoleLabel: "Produktionsleitung",
        status: "IN_PROGRESS",
        dueDate: days(21),
        updatedAt: new Date(),
      });
      await insertRow(db, "ActionStatusEvent", {
        id: crypto.randomUUID(),
        actionId: open.id,
        toStatus: "OPEN",
        byUserId: ASSESSOR,
        createdAt: days(-30),
      });
      await insertRow(db, "ActionStatusEvent", {
        id: crypto.randomUUID(),
        actionId: open.id,
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        byUserId: ASSESSOR,
        createdAt: days(-12),
      });
      const overdue = await insertRow(db, "Action", {
        id: crypto.randomUUID(),
        siteId: site.id,
        riskFindingId: ergoFinding.id,
        title: "Unterweisung zum Heben und Tragen auffrischen",
        description: "Kurzunterweisung für die Fertigung.",
        hierarchyOfControl: "ADMINISTRATIVE_CONTROL",
        responsibleRoleLabel: "EHS",
        status: "OPEN",
        dueDate: days(-5),
        updatedAt: new Date(),
      });
      await insertRow(db, "ActionStatusEvent", {
        id: crypto.randomUUID(),
        actionId: overdue.id,
        toStatus: "OPEN",
        byUserId: ASSESSOR,
        createdAt: days(-25),
      });
      console.log("Maßnahmen: 1 in Umsetzung, 1 überfällig");
    }

    // --- People (fictional) + their job assignments.
    const personDefs = [
      {
        nr: "T-101",
        first: "Lena",
        last: "Hofmann",
        dept: "Fertigung",
        ws: "Montagelinie 1",
      },
      {
        nr: "T-102",
        first: "Jonas",
        last: "Steiner",
        dept: "Fertigung",
        ws: "Schweißplatz",
      },
      {
        nr: "T-103",
        first: "Mira",
        last: "Kaufmann",
        dept: "Lager & Versand",
        ws: "Kommissionierung",
      },
    ];
    const persons = {};
    for (const p of personDefs) {
      persons[p.nr] = await selectOrInsert(
        db,
        "Person",
        { companyId: company.id, personnelNumber: p.nr },
        {
          id: crypto.randomUUID(),
          companyId: company.id,
          firstName: p.first,
          lastName: p.last,
          personnelNumber: p.nr,
          orgUnitId: departments[p.dept].id,
          active: true,
          updatedAt: new Date(),
        },
      );
      await selectOrInsert(
        db,
        "PersonAssignment",
        {
          personId: persons[p.nr].id,
          workstationId: workstations[p.ws].id,
          orgUnitId: null,
        },
        {
          id: crypto.randomUUID(),
          personId: persons[p.nr].id,
          workstationId: workstations[p.ws].id,
          validFrom: days(-200),
        },
      );
    }
    console.log(`Personen: ${personDefs.length} (fiktiv) mit Einsatz`);

    // --- One instruction requirement, attached plant-wide.
    const requirement = await selectOrInsert(
      db,
      "TrainingRequirementType",
      { companyId: company.id, title: "Jährliche Sicherheitsunterweisung" },
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        title: "Jährliche Sicherheitsunterweisung",
        contentOutline:
          COUNTRY === "AT"
            ? "Allgemeine Sicherheitsunterweisung nach §14 ASchG (jährlich)."
            : "Allgemeine Sicherheitsunterweisung nach §12 ArbSchG (jährlich).",
        recurrenceMonths: 12,
        deliveryMethod: "IN_PERSON",
        updatedAt: new Date(),
      },
    );
    await selectOrInsert(
      db,
      "TrainingRequirementSource",
      {
        requirementTypeId: requirement.id,
        subjectType: "ORG_UNIT",
        subjectId: plant.id,
      },
      {
        id: crypto.randomUUID(),
        requirementTypeId: requirement.id,
        subjectType: "ORG_UNIT",
        subjectId: plant.id,
      },
    );

    // --- Two fictional products on real substances, with an SDS each.
    const substanceDefs = [
      {
        trade: "Testclean 40",
        // The real substance behind the fictional product name.
        chemical: "Isopropanol",
        cas: "67-63-0",
        signal: "GEFAHR",
        pictograms: ["GHS02", "GHS07"],
        statements: [
          { kind: "H", code: "H225" },
          { kind: "H", code: "H319" },
          { kind: "P", code: "P210" },
        ],
      },
      {
        trade: "Testlube 10",
        chemical: "Mineralöl (Grundöl)",
        cas: "64742-54-7",
        signal: null,
        pictograms: [],
        statements: [],
      },
    ];
    const substances = {};
    for (const def of substanceDefs) {
      const substance = await selectOrInsert(
        db,
        "Substance",
        { companyId: company.id, tradeName: def.trade },
        {
          id: crypto.randomUUID(),
          companyId: company.id,
          tradeName: def.trade,
          casNumber: def.cas,
          manufacturer: "Beispiel Chemie GmbH",
          ...(def.signal ? { signalWord: def.signal } : {}),
          physicalState: "LIQUID",
          updatedAt: new Date(),
        },
      );
      substances[def.trade] = substance;
      for (const code of def.pictograms) {
        await selectOrInsert(
          db,
          "SubstancePictogram",
          { substanceId: substance.id, pictogram: code },
          {
            id: crypto.randomUUID(),
            substanceId: substance.id,
            pictogram: code,
          },
        );
      }
      for (const st of def.statements) {
        await selectOrInsert(
          db,
          "SubstanceStatement",
          { substanceId: substance.id, code: st.code },
          {
            id: crypto.randomUUID(),
            substanceId: substance.id,
            kind: st.kind,
            code: st.code,
          },
        );
      }
      await selectOrInsert(
        db,
        "SafetyDataSheet",
        { substanceId: substance.id, revisionDate: days(-120) },
        {
          id: crypto.randomUUID(),
          substanceId: substance.id,
          revisionDate: days(-120),
          language: "de",
          supplier: "Beispiel Chemie GmbH",
          extractionMethod: "manual",
        },
      );
      await selectOrInsert(
        db,
        "SubstanceUse",
        {
          substanceId: substance.id,
          workstationId: workstations["Werkstatt"].id,
        },
        {
          id: crypto.randomUUID(),
          substanceId: substance.id,
          siteId: site.id,
          workstationId: workstations["Werkstatt"].id,
          purpose: "Reinigung und Wartung",
          quantityClass: "S",
          activeFrom: days(-150),
        },
      );
    }
    console.log(
      `Gefahrstoffe: ${substanceDefs.length} (fiktive Produkte, echte Stoffe) mit SDB`,
    );

    // --- One near miss, so Ereignisse is not empty.
    await insertRow(db, "Incident", {
      id: crypto.randomUUID(),
      companyId: company.id,
      siteId: site.id,
      type: "BEINAHEUNFALL",
      title: "Palette beim Abstapeln verrutscht",
      description:
        "Beim Abstapeln verrutschte eine Palette. Keine Person betroffen. Keine Namen in dieser Beschreibung.",
      occurredAt: days(-9),
      status: "TRIAGED",
      subjectWorkstationId: workstations["Kommissionierung"].id,
      updatedAt: new Date(),
    });

    // --- Workforce figures, so the rate KPIs compute.
    await selectOrInsert(
      db,
      "SiteWorkforcePeriod",
      {
        siteId: site.id,
        orgUnitId: null,
        periodType: "YEAR",
        year: new Date().getUTCFullYear(),
        periodIndex: 0,
      },
      {
        id: crypto.randomUUID(),
        siteId: site.id,
        periodType: "YEAR",
        year: new Date().getUTCFullYear(),
        periodIndex: 0,
        headcount: 48,
        hoursWorked: 84000,
        updatedAt: new Date(),
      },
    );

    console.log(
      JSON.stringify({
        companyId: company.id,
        siteId: site.id,
        country: COUNTRY,
      }),
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
