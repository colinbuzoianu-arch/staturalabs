-- P6 §6 typical measures (SLD_P6_TYPICAL_MEASURES_APPROVED.md). Two additive
-- tables + an additive Action.typicalMeasureId FK + the founder-approved seed
-- (70 rows under v1-2026-11, active). No new enum (HazardCategory /
-- HierarchyOfControl already exist), so a single migration. RLS enabled
-- (owner-bypass). The partial unique index on isActive mirrors every other
-- single-active catalogue (MethodologyVersion / ExposureLimitCatalogVersion).
--
-- The measure text is founder-approved German good-practice wording (not a
-- legal claim, limit or citation); the row code (PHY-1 …) is kept in notes
-- for traceability back to the approved worksheet.

-- CreateTable: TypicalMeasureCatalogVersion
CREATE TABLE "TypicalMeasureCatalogVersion" (
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TypicalMeasureCatalogVersion_pkey" PRIMARY KEY ("version")
);
CREATE UNIQUE INDEX "TypicalMeasureCatalogVersion_isActive_unique_when_true" ON "TypicalMeasureCatalogVersion"("isActive") WHERE "isActive" = true;
ALTER TABLE "TypicalMeasureCatalogVersion" ENABLE ROW LEVEL SECURITY;

-- CreateTable: TypicalMeasure
CREATE TABLE "TypicalMeasure" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "hazardCategory" "HazardCategory" NOT NULL,
    "hazardCode" TEXT,
    "hierarchyOfControl" "HierarchyOfControl" NOT NULL,
    "measureDe" TEXT NOT NULL,
    "measureEn" TEXT,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TypicalMeasure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TypicalMeasure_catalogVersion_hazardCategory_idx" ON "TypicalMeasure"("catalogVersion", "hazardCategory");
ALTER TABLE "TypicalMeasure" ADD CONSTRAINT "TypicalMeasure_catalogVersion_fkey" FOREIGN KEY ("catalogVersion") REFERENCES "TypicalMeasureCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TypicalMeasure" ENABLE ROW LEVEL SECURITY;

-- AlterTable: Action.typicalMeasureId (additive, nullable, Restrict)
ALTER TABLE "Action" ADD COLUMN "typicalMeasureId" TEXT;
CREATE INDEX "Action_typicalMeasureId_idx" ON "Action"("typicalMeasureId");
ALTER TABLE "Action" ADD CONSTRAINT "Action_typicalMeasureId_fkey" FOREIGN KEY ("typicalMeasureId") REFERENCES "TypicalMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: catalogue version (active)
INSERT INTO "TypicalMeasureCatalogVersion" ("version", "label", "isActive", "activatedAt")
VALUES ('v1-2026-11', 'Typische Maßnahmen v1 (2026-11)', true, CURRENT_TIMESTAMP);

-- Seed: the 70 approved rows
INSERT INTO "TypicalMeasure" ("id", "catalogVersion", "hazardCategory", "hazardCode", "hierarchyOfControl", "measureDe", "measureEn", "order", "notes")
VALUES
-- PHYSICAL_MECHANICAL
(gen_random_uuid()::text, 'v1-2026-11', 'PHYSICAL_MECHANICAL', NULL, 'ELIMINATION', 'Gefahrstelle konstruktiv beseitigen (z. B. Quetsch- oder Scherstelle entfernen)', 'Design out the hazard point (e.g. remove a crush or shear point)', 1, 'PHY-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'PHYSICAL_MECHANICAL', NULL, 'ENGINEERING_CONTROL', 'Trennende Schutzeinrichtung bzw. Verdeckung an bewegten Teilen anbringen', 'Fit a fixed guard or cover on moving parts', 2, 'PHY-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'PHYSICAL_MECHANICAL', NULL, 'ENGINEERING_CONTROL', 'Schutzeinrichtung mit Sicherheitsfunktion einsetzen (z. B. verriegelte Schutztür, Lichtvorhang, Zweihandschaltung)', 'Use a safety-function protective device (e.g. interlocked door, light curtain, two-hand control)', 3, 'PHY-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'PHYSICAL_MECHANICAL', NULL, 'ENGINEERING_CONTROL', 'Verkehrswege sichern: Stolperstellen beseitigen, rutschhemmende Böden, Absturzsicherung', 'Secure walkways: remove trip points, slip-resistant floors, fall protection', 4, 'PHY-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'PHYSICAL_MECHANICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Betriebsanweisung erstellen und Unterweisung durchführen', 'Issue a safe-work instruction and brief workers', 5, 'PHY-5'),
(gen_random_uuid()::text, 'v1-2026-11', 'PHYSICAL_MECHANICAL', NULL, 'PPE', 'Geeignete PSA bereitstellen (z. B. Schnittschutzhandschuhe, Sicherheitsschuhe)', 'Provide suitable PPE (e.g. cut-resistant gloves, safety footwear)', 6, 'PHY-6'),
-- NOISE
(gen_random_uuid()::text, 'v1-2026-11', 'NOISE', NULL, 'SUBSTITUTION', 'Lärmärmere Arbeitsverfahren bzw. Maschinen einsetzen', 'Use quieter processes or machinery', 1, 'NOI-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'NOISE', NULL, 'ENGINEERING_CONTROL', 'Lärmquelle kapseln bzw. Schallschutzkabine einrichten', 'Enclose the noise source or install an acoustic booth', 2, 'NOI-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'NOISE', NULL, 'ENGINEERING_CONTROL', 'Raumakustik verbessern (Schallabsorber, Abschirmwände)', 'Improve room acoustics (absorbers, screens)', 3, 'NOI-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'NOISE', NULL, 'ENGINEERING_CONTROL', 'Arbeitsplätze räumlich von Lärmquellen trennen', 'Separate workplaces from noise sources', 4, 'NOI-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'NOISE', NULL, 'ADMINISTRATIVE_CONTROL', 'Aufenthaltsdauer im Lärmbereich begrenzen und Lärmbereiche kennzeichnen', 'Limit time in noise areas and mark them', 5, 'NOI-5'),
(gen_random_uuid()::text, 'v1-2026-11', 'NOISE', NULL, 'ADMINISTRATIVE_CONTROL', 'Unterweisung zu Lärm und zur richtigen Benutzung von Gehörschutz', 'Instruction on noise and correct use of hearing protection', 6, 'NOI-6'),
(gen_random_uuid()::text, 'v1-2026-11', 'NOISE', NULL, 'PPE', 'Geeigneten Gehörschutz bereitstellen und Benutzung sicherstellen', 'Provide suitable hearing protection and ensure its use', 7, 'NOI-7'),
-- VIBRATION
(gen_random_uuid()::text, 'v1-2026-11', 'VIBRATION', NULL, 'SUBSTITUTION', 'Vibrationsarme Maschinen bzw. Werkzeuge einsetzen', 'Use low-vibration machinery or tools', 1, 'VIB-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'VIBRATION', NULL, 'ENGINEERING_CONTROL', 'Schwingungen an Maschine oder Arbeitsplatz dämpfen (z. B. schwingungsisolierte Sitze, Griffe, Lagerung)', 'Damp vibration at the machine or workplace (e.g. isolated seats, handles, mounts)', 2, 'VIB-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'VIBRATION', NULL, 'ADMINISTRATIVE_CONTROL', 'Expositionsdauer begrenzen und Tätigkeitswechsel einplanen', 'Limit exposure time and plan task rotation', 3, 'VIB-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'VIBRATION', NULL, 'ADMINISTRATIVE_CONTROL', 'Werkzeuge und Maschinen regelmäßig warten (z. B. Unwucht, Verschleiß)', 'Maintain tools and machinery regularly (e.g. imbalance, wear)', 4, 'VIB-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'VIBRATION', NULL, 'PPE', 'Kälte- und Nässeschutzkleidung bei Hand-Arm-Vibration bereitstellen', 'Provide cold and wet protection for hand-arm vibration work', 5, 'VIB-5'),
-- LIGHTING
(gen_random_uuid()::text, 'v1-2026-11', 'LIGHTING', NULL, 'ENGINEERING_CONTROL', 'Beleuchtungsstärke an die Sehaufgabe anpassen (Allgemein- und Arbeitsplatzbeleuchtung)', 'Match illuminance to the visual task (general and task lighting)', 1, 'LIG-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'LIGHTING', NULL, 'ENGINEERING_CONTROL', 'Blendung und Reflexionen vermeiden (Leuchtenanordnung, Entblendung, Bildschirmposition)', 'Avoid glare and reflections (luminaire layout, shielding, screen position)', 2, 'LIG-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'LIGHTING', NULL, 'ENGINEERING_CONTROL', 'Tageslichtnutzung verbessern (z. B. Arbeitsplatzanordnung, Sonnenschutz)', 'Improve daylight use (e.g. layout, sun shading)', 3, 'LIG-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'LIGHTING', NULL, 'ADMINISTRATIVE_CONTROL', 'Leuchten regelmäßig warten, reinigen und defekte Leuchtmittel tauschen', 'Maintain and clean luminaires, replace failed lamps', 4, 'LIG-4'),
-- CLIMATE_THERMAL
(gen_random_uuid()::text, 'v1-2026-11', 'CLIMATE_THERMAL', NULL, 'ENGINEERING_CONTROL', 'Wärme- bzw. Kältequelle kapseln oder abschirmen', 'Enclose or shield the heat or cold source', 1, 'CLI-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'CLIMATE_THERMAL', NULL, 'ENGINEERING_CONTROL', 'Lüftung, Klimatisierung bzw. Heizung anpassen', 'Adjust ventilation, air conditioning or heating', 2, 'CLI-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'CLIMATE_THERMAL', NULL, 'ENGINEERING_CONTROL', 'Bei Arbeiten im Freien Beschattung und UV-Schutz einrichten', 'Provide shade and UV protection for outdoor work', 3, 'CLI-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'CLIMATE_THERMAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Belastende Tätigkeiten in kühlere Tageszeiten verlegen', 'Move strenuous work to cooler times of day', 4, 'CLI-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'CLIMATE_THERMAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Entwärmungs- bzw. Aufwärmpausen, Getränke bereitstellen, Tätigkeitswechsel', 'Cooling or warming breaks, provide drinks, task rotation', 5, 'CLI-5'),
(gen_random_uuid()::text, 'v1-2026-11', 'CLIMATE_THERMAL', NULL, 'PPE', 'Geeignete Schutzkleidung gegen Hitze, Kälte bzw. Witterung bereitstellen', 'Provide suitable clothing against heat, cold or weather', 6, 'CLI-6'),
-- CHEMICAL
(gen_random_uuid()::text, 'v1-2026-11', 'CHEMICAL', NULL, 'SUBSTITUTION', 'Gefährlichen Arbeitsstoff durch weniger gefährlichen ersetzen (Ersatzstoffprüfung)', 'Replace the hazardous agent with a less hazardous one (substitution check)', 1, 'CHE-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'CHEMICAL', NULL, 'ENGINEERING_CONTROL', 'Geschlossenes System bzw. Absaugung an der Entstehungsstelle', 'Closed system or local exhaust at source', 2, 'CHE-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'CHEMICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Mengen am Arbeitsplatz auf den Tagesbedarf begrenzen', 'Limit quantities at the workplace to daily need', 3, 'CHE-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'CHEMICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Gebinde richtig kennzeichnen und sicher lagern', 'Label containers correctly and store safely', 4, 'CHE-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'CHEMICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Betriebsanweisung für den Arbeitsstoff erstellen und Unterweisung durchführen', 'Issue a substance safe-work instruction and brief workers', 5, 'CHE-5'),
(gen_random_uuid()::text, 'v1-2026-11', 'CHEMICAL', NULL, 'PPE', 'Geeignete PSA bereitstellen (z. B. Atemschutz, Chemikalienschutzhandschuhe, Schutzbrille)', 'Provide suitable PPE (e.g. RPE, chemical gloves, goggles)', 6, 'CHE-6'),
-- DUST_PARTICULATE
(gen_random_uuid()::text, 'v1-2026-11', 'DUST_PARTICULATE', NULL, 'SUBSTITUTION', 'Staubarme Verfahren einsetzen (z. B. Nassbearbeitung, staubarme Produktformen)', 'Use low-dust processes (e.g. wet working, low-dust product forms)', 1, 'DUS-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'DUST_PARTICULATE', NULL, 'ENGINEERING_CONTROL', 'Absaugung an der Entstehungsstelle bzw. Einhausung', 'Local exhaust at source or enclosure', 2, 'DUS-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'DUST_PARTICULATE', NULL, 'ADMINISTRATIVE_CONTROL', 'Regelmäßig staubarm reinigen (Absaugen statt Kehren oder Abblasen)', 'Clean regularly with low-dust methods (vacuum, no sweeping or blowing)', 3, 'DUS-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'DUST_PARTICULATE', NULL, 'PPE', 'Atemschutz der geeigneten Schutzstufe bereitstellen', 'Provide RPE of the appropriate protection level', 4, 'DUS-4'),
-- BIOLOGICAL
(gen_random_uuid()::text, 'v1-2026-11', 'BIOLOGICAL', NULL, 'ELIMINATION', 'Kontakt mit der Expositionsquelle vermeiden bzw. Verfahren schließen', 'Avoid contact with the source or close the process', 1, 'BIO-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'BIOLOGICAL', NULL, 'ENGINEERING_CONTROL', 'Lüftung, Flächendesinfektion und abgetrennte Bereiche einrichten', 'Ventilation, surface disinfection, segregated areas', 2, 'BIO-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'BIOLOGICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Hygieneplan erstellen und Unterweisung durchführen', 'Issue a hygiene plan and brief workers', 3, 'BIO-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'BIOLOGICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Impfangebot über die Arbeitsmedizin organisieren', 'Arrange a vaccination offer via occupational medicine', 4, 'BIO-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'BIOLOGICAL', NULL, 'PPE', 'Schutzhandschuhe, Schutzkleidung bzw. Atemschutz bereitstellen', 'Provide gloves, protective clothing or RPE', 5, 'BIO-5'),
-- ERGONOMIC_MSD
(gen_random_uuid()::text, 'v1-2026-11', 'ERGONOMIC_MSD', NULL, 'ELIMINATION', 'Manuelle Lastenhandhabung durch Prozessänderung oder Automatisierung vermeiden', 'Avoid manual handling through process change or automation', 1, 'ERG-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'ERGONOMIC_MSD', NULL, 'SUBSTITUTION', 'Lastgewicht verringern (z. B. kleinere Gebinde, geteilte Lasten)', 'Reduce load weight (e.g. smaller containers, split loads)', 2, 'ERG-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'ERGONOMIC_MSD', NULL, 'ENGINEERING_CONTROL', 'Hebe- und Transporthilfen einsetzen', 'Use lifting and transport aids', 3, 'ERG-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'ERGONOMIC_MSD', NULL, 'ENGINEERING_CONTROL', 'Arbeitsplatz höhenverstellbar und ergonomisch gestalten, Greifwege verkürzen', 'Height-adjustable, ergonomic workplace, shorter reach distances', 4, 'ERG-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'ERGONOMIC_MSD', NULL, 'ADMINISTRATIVE_CONTROL', 'Tätigkeitswechsel und Belastungspausen einplanen', 'Plan task rotation and recovery breaks', 5, 'ERG-5'),
(gen_random_uuid()::text, 'v1-2026-11', 'ERGONOMIC_MSD', NULL, 'ADMINISTRATIVE_CONTROL', 'Unterweisung zu belastungsarmem Heben, Tragen und Arbeiten', 'Instruction on low-strain lifting, carrying and working', 6, 'ERG-6'),
-- PSYCHOSOCIAL
(gen_random_uuid()::text, 'v1-2026-11', 'PSYCHOSOCIAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Arbeitsorganisation anpassen (Aufgabengestaltung, Pausen, Handlungsspielraum)', 'Adjust work organisation (task design, breaks, autonomy)', 1, 'PSY-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'PSYCHOSOCIAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Arbeitsmenge und Termindruck steuern, Personalbemessung prüfen', 'Manage workload and deadline pressure, review staffing', 2, 'PSY-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'PSYCHOSOCIAL', NULL, 'ENGINEERING_CONTROL', 'Arbeitsumgebung belastungsarm gestalten (z. B. Störungen, Lärm, Unterbrechungen reduzieren)', 'Design a low-strain environment (e.g. reduce disruption, noise, interruptions)', 3, 'PSY-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'PSYCHOSOCIAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Führung und Kommunikation stärken, Konfliktklärung etablieren', 'Strengthen leadership and communication, establish conflict resolution', 4, 'PSY-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'PSYCHOSOCIAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Unterstützungsangebote bereitstellen (z. B. externe Beratung)', 'Provide support offers (e.g. external counselling)', 5, 'PSY-5'),
-- ELECTRICAL
(gen_random_uuid()::text, 'v1-2026-11', 'ELECTRICAL', NULL, 'ENGINEERING_CONTROL', 'Schutz durch Konstruktion (Schutzkleinspannung, Schutzisolierung)', 'Protection by design (SELV, double insulation)', 1, 'ELE-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'ELECTRICAL', NULL, 'ENGINEERING_CONTROL', 'Fehlerstrom-Schutzeinrichtung, Abdeckungen und Not-Halt vorsehen', 'Provide RCD, covers and emergency stop', 2, 'ELE-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'ELECTRICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Wiederkehrende Prüfung elektrischer Anlagen und Betriebsmittel durchführen', 'Periodic testing of electrical installations and equipment', 3, 'ELE-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'ELECTRICAL', NULL, 'ADMINISTRATIVE_CONTROL', 'Arbeiten an elektrischen Anlagen nur durch Elektrofachkräfte und im freigeschalteten Zustand (5 Sicherheitsregeln)', 'Electrical work only by qualified persons, de-energised (5 safety rules)', 4, 'ELE-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'ELECTRICAL', NULL, 'PPE', 'Isolierende Schutzausrüstung bereitstellen', 'Provide insulating protective equipment', 5, 'ELE-5'),
-- FIRE_EXPLOSION
(gen_random_uuid()::text, 'v1-2026-11', 'FIRE_EXPLOSION', NULL, 'SUBSTITUTION', 'Brennbare Stoffe bzw. Zündquellen vermeiden oder ersetzen', 'Avoid or replace flammable substances or ignition sources', 1, 'FIR-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'FIRE_EXPLOSION', NULL, 'ENGINEERING_CONTROL', 'Explosionsfähige Atmosphäre verhindern (Lüftung, Inertisierung) und explosionsgeschützte Betriebsmittel einsetzen', 'Prevent explosive atmospheres (ventilation, inerting), use explosion-protected equipment', 2, 'FIR-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'FIRE_EXPLOSION', NULL, 'ENGINEERING_CONTROL', 'Löscheinrichtungen und Brandmelder bereitstellen', 'Provide extinguishing equipment and fire detection', 3, 'FIR-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'FIRE_EXPLOSION', NULL, 'ADMINISTRATIVE_CONTROL', 'Explosionsschutzdokument und Zoneneinteilung erstellen bzw. aktualisieren', 'Create or update the explosion-protection document and zoning', 4, 'FIR-4'),
(gen_random_uuid()::text, 'v1-2026-11', 'FIRE_EXPLOSION', NULL, 'ADMINISTRATIVE_CONTROL', 'Brandschutzorganisation festlegen, Mengen begrenzen, Bereiche kennzeichnen', 'Define fire-safety organisation, limit quantities, mark areas', 5, 'FIR-5'),
(gen_random_uuid()::text, 'v1-2026-11', 'FIRE_EXPLOSION', NULL, 'ADMINISTRATIVE_CONTROL', 'Unterweisung und Brandschutz- bzw. Räumungsübungen durchführen', 'Instruction and fire or evacuation drills', 6, 'FIR-6'),
(gen_random_uuid()::text, 'v1-2026-11', 'FIRE_EXPLOSION', NULL, 'PPE', 'Schwer entflammbare Schutzkleidung bereitstellen', 'Provide flame-retardant protective clothing', 7, 'FIR-7'),
-- RADIATION
(gen_random_uuid()::text, 'v1-2026-11', 'RADIATION', NULL, 'SUBSTITUTION', 'Strahlenquelle vermeiden bzw. schwächere Quelle oder anderes Verfahren einsetzen', 'Avoid the source or use a weaker source or other process', 1, 'RAD-1'),
(gen_random_uuid()::text, 'v1-2026-11', 'RADIATION', NULL, 'ENGINEERING_CONTROL', 'Abschirmung, Abstand und geschlossene Anlagen vorsehen', 'Provide shielding, distance and enclosed installations', 2, 'RAD-2'),
(gen_random_uuid()::text, 'v1-2026-11', 'RADIATION', NULL, 'ADMINISTRATIVE_CONTROL', 'Aufenthaltszeit begrenzen, Bereiche kennzeichnen und abgrenzen', 'Limit dwell time, mark and cordon areas', 3, 'RAD-3'),
(gen_random_uuid()::text, 'v1-2026-11', 'RADIATION', NULL, 'PPE', 'Geeignete PSA bereitstellen (z. B. UV-, Laser- oder Schweißerschutz)', 'Provide suitable PPE (e.g. UV, laser or welding protection)', 4, 'RAD-4');
