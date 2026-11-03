# SLD P6 — Typical measures per hazard category: founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-03
**Review:** editorial review of `SLD_P6_TYPICAL_MEASURES_DRAFT.md` (wording, DACH terminology, prevention-hierarchy tier). Delegated review by Claude, accepted by the founder. These are SLD's own good-practice wordings, not legal claims, limits or citations.

This file replaces the draft as the build input. CC: seed **only the rows in §3** (status ✅, ✏️ or ➕; ✗ rows are not seeded), then follow §4.

---

## 1. Decisions on CC's three questions

**Q1 — Lines:** reviewed below. Marks: ✅ keep · ✏️ reworded or re-tiered · ✗ dropped (replaced by a split) · ➕ added.

**Q2 — Grain and language:**
- **Per category: approved for v1.** Add a nullable `hazardCode` column now (references a system `Hazard.code`, null = applies to the whole category), so measures for specific hazards can be added later without a migration. None are seeded with a code in this version.
- **German first: approved**, written in neutral DACH German:
  - Don't use country-specific legal terms in the measure text. Write "Gefahrstoff/Arbeitsstoff" generically as "gefährlicher Arbeitsstoff". Write "Betriebsanweisung" without "nach Gefahrstoffrecht".
  - No law or standard numbers in the text.
  - Store with ß. For `de-CH` display, apply ß→ss at render time (the standard Swiss convention), with no separate CH rows.
- Add a nullable `measureEn` column, filled from the English gloss below, for the EN UI. RO falls back to EN. Localisation beyond that stays a later question.

**Q3 — Model and plug-in: approved, with three additions:**
1. **`hazardCode`** (nullable), as above.
2. **`Action.typicalMeasureId`** (nullable FK, additive). It records that an action started from a suggestion, even after the assessor edits the title. Provenance is first-class in this product. It also allows later "suggested vs. custom" reporting, which needs no person data.
3. **Prevention-hierarchy hint in the picker.** Show each suggestion with its tier badge, ordered ELIMINATION → PPE. If the assessor picks a PPE or ADMINISTRATIVE_CONTROL measure while the finding has no open or implemented action at a higher tier, show a non-blocking hint: *"Technische und organisatorische Maßnahmen haben Vorrang vor PSA (STOP-Prinzip)."* Never block saving.

---

## 2. Review notes (why lines changed)

- **Tiers fixed:** PSY-1 was ENGINEERING_CONTROL, but changing work organisation is organisational, so it is now ADMINISTRATIVE_CONTROL.
- **Bundled lines split** where one line mixed tiers. One suggestion is one action with one tier: CHE-3, ERG-3, LIG-3, ELE-3, FIR-2, FIR-4.
- **Missing top tiers added:** ERG (avoid manual handling: ELIMINATION), PHY (slips/trips/falls are part of the mechanical category).
- **Missing lower tiers added** where good practice includes them: VIB (cold/wet protective clothing for hand-arm vibration), FIR (flame-retardant clothing), NOI (instruction).
- **Terminology:** "zwangsläufig wirkende Schutzeinrichtung" isn't standard usage, so it is replaced. "Elektrotechnische Prüfung" now reads "Wiederkehrende Prüfung elektrischer Anlagen und Betriebsmittel". The Freischalten line now names the 5 Sicherheitsregeln.
- **No person-related measures:** nothing that implies personal dosimetry, individual health monitoring or person-level tracking. Vaccination is worded as an offer via occupational medicine.

---

## 3. Approved catalogue (seed exactly these rows)

`order` = row order within the category. Tier = `HierarchyOfControl` value.

### PHYSICAL_MECHANICAL
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| PHY-1 | Gefahrstelle konstruktiv beseitigen (z. B. Quetsch- oder Scherstelle entfernen) | Design out the hazard point (e.g. remove a crush or shear point) | ELIMINATION | ✏️ |
| PHY-2 | Trennende Schutzeinrichtung bzw. Verdeckung an bewegten Teilen anbringen | Fit a fixed guard or cover on moving parts | ENGINEERING_CONTROL | ✅ |
| PHY-3 | Schutzeinrichtung mit Sicherheitsfunktion einsetzen (z. B. verriegelte Schutztür, Lichtvorhang, Zweihandschaltung) | Use a safety-function protective device (e.g. interlocked door, light curtain, two-hand control) | ENGINEERING_CONTROL | ✏️ |
| PHY-4 | Verkehrswege sichern: Stolperstellen beseitigen, rutschhemmende Böden, Absturzsicherung | Secure walkways: remove trip points, slip-resistant floors, fall protection | ENGINEERING_CONTROL | ➕ |
| PHY-5 | Betriebsanweisung erstellen und Unterweisung durchführen | Issue a safe-work instruction and brief workers | ADMINISTRATIVE_CONTROL | ✅ |
| PHY-6 | Geeignete PSA bereitstellen (z. B. Schnittschutzhandschuhe, Sicherheitsschuhe) | Provide suitable PPE (e.g. cut-resistant gloves, safety footwear) | PPE | ✏️ |

### NOISE
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| NOI-1 | Lärmärmere Arbeitsverfahren bzw. Maschinen einsetzen | Use quieter processes or machinery | SUBSTITUTION | ✏️ |
| NOI-2 | Lärmquelle kapseln bzw. Schallschutzkabine einrichten | Enclose the noise source or install an acoustic booth | ENGINEERING_CONTROL | ✅ |
| NOI-3 | Raumakustik verbessern (Schallabsorber, Abschirmwände) | Improve room acoustics (absorbers, screens) | ENGINEERING_CONTROL | ✏️ |
| NOI-4 | Arbeitsplätze räumlich von Lärmquellen trennen | Separate workplaces from noise sources | ENGINEERING_CONTROL | ➕ |
| NOI-5 | Aufenthaltsdauer im Lärmbereich begrenzen und Lärmbereiche kennzeichnen | Limit time in noise areas and mark them | ADMINISTRATIVE_CONTROL | ✏️ |
| NOI-6 | Unterweisung zu Lärm und zur richtigen Benutzung von Gehörschutz | Instruction on noise and correct use of hearing protection | ADMINISTRATIVE_CONTROL | ➕ |
| NOI-7 | Geeigneten Gehörschutz bereitstellen und Benutzung sicherstellen | Provide suitable hearing protection and ensure its use | PPE | ✏️ |

### VIBRATION
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| VIB-1 | Vibrationsarme Maschinen bzw. Werkzeuge einsetzen | Use low-vibration machinery or tools | SUBSTITUTION | ✏️ |
| VIB-2 | Schwingungen an Maschine oder Arbeitsplatz dämpfen (z. B. schwingungsisolierte Sitze, Griffe, Lagerung) | Damp vibration at the machine or workplace (e.g. isolated seats, handles, mounts) | ENGINEERING_CONTROL | ✏️ |
| VIB-3 | Expositionsdauer begrenzen und Tätigkeitswechsel einplanen | Limit exposure time and plan task rotation | ADMINISTRATIVE_CONTROL | ✅ |
| VIB-4 | Werkzeuge und Maschinen regelmäßig warten (z. B. Unwucht, Verschleiß) | Maintain tools and machinery regularly (e.g. imbalance, wear) | ADMINISTRATIVE_CONTROL | ✏️ |
| VIB-5 | Kälte- und Nässeschutzkleidung bei Hand-Arm-Vibration bereitstellen | Provide cold and wet protection for hand-arm vibration work | PPE | ➕ |

### LIGHTING
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| LIG-1 | Beleuchtungsstärke an die Sehaufgabe anpassen (Allgemein- und Arbeitsplatzbeleuchtung) | Match illuminance to the visual task (general and task lighting) | ENGINEERING_CONTROL | ✅ |
| LIG-2 | Blendung und Reflexionen vermeiden (Leuchtenanordnung, Entblendung, Bildschirmposition) | Avoid glare and reflections (luminaire layout, shielding, screen position) | ENGINEERING_CONTROL | ✏️ |
| LIG-3 | Tageslichtnutzung verbessern (z. B. Arbeitsplatzanordnung, Sonnenschutz) | Improve daylight use (e.g. layout, sun shading) | ENGINEERING_CONTROL | ➕ (split) |
| LIG-4 | Leuchten regelmäßig warten, reinigen und defekte Leuchtmittel tauschen | Maintain and clean luminaires, replace failed lamps | ADMINISTRATIVE_CONTROL | ➕ (split) |
| — | ~~Tageslichtnutzung verbessern, Wartung/Reinigung der Leuchten~~ | | | ✗ (split into LIG-3/4) |

### CLIMATE_THERMAL
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| CLI-1 | Wärme- bzw. Kältequelle kapseln oder abschirmen | Enclose or shield the heat or cold source | ENGINEERING_CONTROL | ✅ |
| CLI-2 | Lüftung, Klimatisierung bzw. Heizung anpassen | Adjust ventilation, air conditioning or heating | ENGINEERING_CONTROL | ✅ |
| CLI-3 | Bei Arbeiten im Freien Beschattung und UV-Schutz einrichten | Provide shade and UV protection for outdoor work | ENGINEERING_CONTROL | ➕ |
| CLI-4 | Belastende Tätigkeiten in kühlere Tageszeiten verlegen | Move strenuous work to cooler times of day | ADMINISTRATIVE_CONTROL | ➕ |
| CLI-5 | Entwärmungs- bzw. Aufwärmpausen, Getränke bereitstellen, Tätigkeitswechsel | Cooling or warming breaks, provide drinks, task rotation | ADMINISTRATIVE_CONTROL | ✏️ |
| CLI-6 | Geeignete Schutzkleidung gegen Hitze, Kälte bzw. Witterung bereitstellen | Provide suitable clothing against heat, cold or weather | PPE | ✏️ |

### CHEMICAL
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| CHE-1 | Gefährlichen Arbeitsstoff durch weniger gefährlichen ersetzen (Ersatzstoffprüfung) | Replace the hazardous agent with a less hazardous one (substitution check) | SUBSTITUTION | ✏️ |
| CHE-2 | Geschlossenes System bzw. Absaugung an der Entstehungsstelle | Closed system or local exhaust at source | ENGINEERING_CONTROL | ✅ |
| CHE-3 | Mengen am Arbeitsplatz auf den Tagesbedarf begrenzen | Limit quantities at the workplace to daily need | ADMINISTRATIVE_CONTROL | ➕ (split) |
| CHE-4 | Gebinde richtig kennzeichnen und sicher lagern | Label containers correctly and store safely | ADMINISTRATIVE_CONTROL | ➕ (split) |
| CHE-5 | Betriebsanweisung für den Arbeitsstoff erstellen und Unterweisung durchführen | Issue a substance safe-work instruction and brief workers | ADMINISTRATIVE_CONTROL | ✏️ |
| CHE-6 | Geeignete PSA bereitstellen (z. B. Atemschutz, Chemikalienschutzhandschuhe, Schutzbrille) | Provide suitable PPE (e.g. RPE, chemical gloves, goggles) | PPE | ✏️ |
| — | ~~Mengen begrenzen, Expositionszeit reduzieren, Kennzeichnung/Lagerung~~ | | | ✗ (split into CHE-3/4) |

### DUST_PARTICULATE
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| DUS-1 | Staubarme Verfahren einsetzen (z. B. Nassbearbeitung, staubarme Produktformen) | Use low-dust processes (e.g. wet working, low-dust product forms) | SUBSTITUTION | ✏️ |
| DUS-2 | Absaugung an der Entstehungsstelle bzw. Einhausung | Local exhaust at source or enclosure | ENGINEERING_CONTROL | ✅ |
| DUS-3 | Regelmäßig staubarm reinigen (Absaugen statt Kehren oder Abblasen) | Clean regularly with low-dust methods (vacuum, no sweeping or blowing) | ADMINISTRATIVE_CONTROL | ✏️ |
| DUS-4 | Atemschutz der geeigneten Schutzstufe bereitstellen | Provide RPE of the appropriate protection level | PPE | ✏️ |

### BIOLOGICAL
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| BIO-1 | Kontakt mit der Expositionsquelle vermeiden bzw. Verfahren schließen | Avoid contact with the source or close the process | ELIMINATION | ✅ |
| BIO-2 | Lüftung, Flächendesinfektion und abgetrennte Bereiche einrichten | Ventilation, surface disinfection, segregated areas | ENGINEERING_CONTROL | ✅ |
| BIO-3 | Hygieneplan erstellen und Unterweisung durchführen | Issue a hygiene plan and brief workers | ADMINISTRATIVE_CONTROL | ✏️ |
| BIO-4 | Impfangebot über die Arbeitsmedizin organisieren | Arrange a vaccination offer via occupational medicine | ADMINISTRATIVE_CONTROL | ➕ (split) |
| BIO-5 | Schutzhandschuhe, Schutzkleidung bzw. Atemschutz bereitstellen | Provide gloves, protective clothing or RPE | PPE | ✅ |

### ERGONOMIC_MSD
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| ERG-1 | Manuelle Lastenhandhabung durch Prozessänderung oder Automatisierung vermeiden | Avoid manual handling through process change or automation | ELIMINATION | ➕ |
| ERG-2 | Lastgewicht verringern (z. B. kleinere Gebinde, geteilte Lasten) | Reduce load weight (e.g. smaller containers, split loads) | SUBSTITUTION | ➕ (split) |
| ERG-3 | Hebe- und Transporthilfen einsetzen | Use lifting and transport aids | ENGINEERING_CONTROL | ✏️ |
| ERG-4 | Arbeitsplatz höhenverstellbar und ergonomisch gestalten, Greifwege verkürzen | Height-adjustable, ergonomic workplace, shorter reach distances | ENGINEERING_CONTROL | ✏️ |
| ERG-5 | Tätigkeitswechsel und Belastungspausen einplanen | Plan task rotation and recovery breaks | ADMINISTRATIVE_CONTROL | ➕ (split) |
| ERG-6 | Unterweisung zu belastungsarmem Heben, Tragen und Arbeiten | Instruction on low-strain lifting, carrying and working | ADMINISTRATIVE_CONTROL | ✏️ |
| — | ~~Lasten verringern, Greifwege optimieren, Tätigkeitswechsel~~ | | | ✗ (split into ERG-2/4/5) |

### PSYCHOSOCIAL
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| PSY-1 | Arbeitsorganisation anpassen (Aufgabengestaltung, Pausen, Handlungsspielraum) | Adjust work organisation (task design, breaks, autonomy) | ADMINISTRATIVE_CONTROL | ✏️ (re-tiered) |
| PSY-2 | Arbeitsmenge und Termindruck steuern, Personalbemessung prüfen | Manage workload and deadline pressure, review staffing | ADMINISTRATIVE_CONTROL | ✅ |
| PSY-3 | Arbeitsumgebung belastungsarm gestalten (z. B. Störungen, Lärm, Unterbrechungen reduzieren) | Design a low-strain environment (e.g. reduce disruption, noise, interruptions) | ENGINEERING_CONTROL | ➕ |
| PSY-4 | Führung und Kommunikation stärken, Konfliktklärung etablieren | Strengthen leadership and communication, establish conflict resolution | ADMINISTRATIVE_CONTROL | ✏️ |
| PSY-5 | Unterstützungsangebote bereitstellen (z. B. externe Beratung) | Provide support offers (e.g. external counselling) | ADMINISTRATIVE_CONTROL | ✏️ |

### ELECTRICAL
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| ELE-1 | Schutz durch Konstruktion (Schutzkleinspannung, Schutzisolierung) | Protection by design (SELV, double insulation) | ENGINEERING_CONTROL | ✏️ |
| ELE-2 | Fehlerstrom-Schutzeinrichtung, Abdeckungen und Not-Halt vorsehen | Provide RCD, covers and emergency stop | ENGINEERING_CONTROL | ✏️ |
| ELE-3 | Wiederkehrende Prüfung elektrischer Anlagen und Betriebsmittel durchführen | Periodic testing of electrical installations and equipment | ADMINISTRATIVE_CONTROL | ➕ (split) |
| ELE-4 | Arbeiten an elektrischen Anlagen nur durch Elektrofachkräfte und im freigeschalteten Zustand (5 Sicherheitsregeln) | Electrical work only by qualified persons, de-energised (5 safety rules) | ADMINISTRATIVE_CONTROL | ➕ (split) |
| ELE-5 | Isolierende Schutzausrüstung bereitstellen | Provide insulating protective equipment | PPE | ✅ |
| — | ~~Elektrotechnische Prüfung, nur Elektrofachkraft, Freischalten~~ | | | ✗ (split into ELE-3/4) |

### FIRE_EXPLOSION
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| FIR-1 | Brennbare Stoffe bzw. Zündquellen vermeiden oder ersetzen | Avoid or replace flammable substances or ignition sources | SUBSTITUTION | ✏️ |
| FIR-2 | Explosionsfähige Atmosphäre verhindern (Lüftung, Inertisierung) und explosionsgeschützte Betriebsmittel einsetzen | Prevent explosive atmospheres (ventilation, inerting), use explosion-protected equipment | ENGINEERING_CONTROL | ➕ (split) |
| FIR-3 | Löscheinrichtungen und Brandmelder bereitstellen | Provide extinguishing equipment and fire detection | ENGINEERING_CONTROL | ➕ (split) |
| FIR-4 | Explosionsschutzdokument und Zoneneinteilung erstellen bzw. aktualisieren | Create or update the explosion-protection document and zoning | ADMINISTRATIVE_CONTROL | ➕ (split) |
| FIR-5 | Brandschutzorganisation festlegen, Mengen begrenzen, Bereiche kennzeichnen | Define fire-safety organisation, limit quantities, mark areas | ADMINISTRATIVE_CONTROL | ✅ |
| FIR-6 | Unterweisung und Brandschutz- bzw. Räumungsübungen durchführen | Instruction and fire or evacuation drills | ADMINISTRATIVE_CONTROL | ➕ (split) |
| FIR-7 | Schwer entflammbare Schutzkleidung bereitstellen | Provide flame-retardant protective clothing | PPE | ➕ |
| — | ~~Ex-Schutz-Zonen, Lüftung, Explosionsschutzkonzept~~ | | | ✗ (split into FIR-2/4) |
| — | ~~Löschmittel bereitstellen, Unterweisung/Übungen~~ | | | ✗ (split into FIR-3/6) |

### RADIATION
| # | measureDe | measureEn | Tier | Mark |
|---|---|---|---|---|
| RAD-1 | Strahlenquelle vermeiden bzw. schwächere Quelle oder anderes Verfahren einsetzen | Avoid the source or use a weaker source or other process | SUBSTITUTION | ✏️ |
| RAD-2 | Abschirmung, Abstand und geschlossene Anlagen vorsehen | Provide shielding, distance and enclosed installations | ENGINEERING_CONTROL | ✅ |
| RAD-3 | Aufenthaltszeit begrenzen, Bereiche kennzeichnen und abgrenzen | Limit dwell time, mark and cordon areas | ADMINISTRATIVE_CONTROL | ✅ |
| RAD-4 | Geeignete PSA bereitstellen (z. B. UV-, Laser- oder Schweißerschutz) | Provide suitable PPE (e.g. UV, laser or welding protection) | PPE | ✏️ |

**Total seeded: 70 rows** across all 13 categories (PHY 6 · NOI 7 · VIB 5 · LIG 4 · CLI 6 · CHE 6 · DUS 4 · BIO 5 · ERG 6 · PSY 5 · ELE 5 · FIR 7 · RAD 4).

---

## 4. Build instructions for CC

1. **Schema.** `TypicalMeasureCatalogVersion` (single active, fail-closed, pattern: `ExposureLimitCatalogVersion`) + `TypicalMeasure` (`catalogVersion`, `hazardCategory`, nullable `hazardCode`, `hierarchyOfControl`, `measureDe`, nullable `measureEn`, `order`, nullable `notes`). Add `Action.typicalMeasureId` (nullable FK, `Restrict`). Hand-written migrations, enum-only first if any enum is touched, RLS on new tables.
2. **Seed** exactly the §3 rows (70) under catalogue version `v1-2026-11`, active. Put the row code (e.g. `PHY-3`) in `notes` for traceability. Verify the row count per category against §3.
3. **Picker** in the raise-action-from-finding flow, everywhere that flow exists (hub, risk-assessment detail, Maßnahmen):
   - Show the measures for the finding's category, plus its `hazardCode` rows when they exist, ordered by tier, then `order`.
   - Selecting one pre-fills title and `hierarchyOfControl` and sets `typicalMeasureId`. The assessor can edit everything and must confirm.
   - Show the STOP hint from §1 Q3. It is non-blocking.
   - DE text from `measureDe`; EN UI uses `measureEn`, RO falls back to EN. `de-CH` renders ß→ss.
   - Environmental findings get no picker in this version.
4. **Verify.** tsc/Biome/Vitest green, with unit tests for ordering and the STOP-hint rule. HTTP walkthrough in German on the AT and DE demo sites: raise an action from a NOISE finding via the picker, edit the title, save, and confirm that `typicalMeasureId` and `hierarchyOfControl` were stored.
5. Then continue with **P7 (Personen + Unterweisungen)** per `SLD_RESTRUCTURE_PLAN_platform-modules.md`.
