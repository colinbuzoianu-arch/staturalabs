# SLD_P6_TYPICAL_MEASURES_DRAFT — typical measures per hazard (for founder verification)

**Status: DRAFT — awaiting founder sign-off. Nothing here is seeded or wired into the UI yet.**

Per `SLD_RESTRUCTURE_PLAN_platform-modules.md` §6 ("Typical measures per hazard — versioned system data, founder-reviewed wording — offered as suggestions when raising actions, never auto-created") and the §11 gate ("draft … and stop for my verification before seeding or writing UI text").

## What this is (and is not)

- **Suggestions only.** When an assessor raises an `Action` from a `RiskFinding`, the system will offer the measures listed for that finding's `HazardCategory` as one-click starting points to pre-fill the action's title + `hierarchyOfControl`. The assessor always edits/confirms; **nothing is ever auto-created** (same discipline as every other suggestion in this product).
- **Not legal claims, not limits.** These are SLD's own good-practice **wordings**, ordered by the STOP/TOP prevention hierarchy (§7 ASchG *Grundsätze der Gefahrenverhütung*: eliminate → substitute → engineering → organisational → PPE). They are **not** a reproduction of any standard, not a prescribed catalogue, and carry no legal figure. The verification you're being asked for is editorial: *is each wording accurate, appropriate, and in the right hierarchy tier for a DACH audience?*
- **German-first** (the DACH operating language, matching SGD/AWK). An English gloss is shown here only for your review; the seeded rows will carry German. (Localisation of the suggestion text is a later question — flagged, not decided.)

## Proposed model (not built yet)

`TypicalMeasure` catalogue, versioned the same fail-closed way as every other catalogue here (`TypicalMeasureCatalogVersion`, single active row, enum-first migration):

| field | type | note |
|---|---|---|
| `catalogVersion` | FK | active-version pattern |
| `hazardCategory` | `HazardCategory` | which findings it's offered for |
| `hierarchyOfControl` | `HierarchyOfControl` | pre-fills `Action.hierarchyOfControl` |
| `measureDe` | String | the suggestion wording (German) |
| `order` | Int | display order within the category (hierarchy-first) |
| `notes` | String? | optional internal note / standard it's inspired by |

Plug-in point: the "raise an action from a finding" flow (Maßnahmen / the finding → action path). The picker lists this category's measures; selecting one pre-fills the new action's title + hierarchy; the assessor edits and saves. No change to `Action` itself.

---

## Draft measures by category

Ordered within each category by prevention hierarchy (ELIMINATION → SUBSTITUTION → ENGINEERING_CONTROL → ADMINISTRATIVE_CONTROL → PPE). Please ✅ / edit / ✏️ / ✗ each line.

### PHYSICAL_MECHANICAL (mechanische Gefährdungen)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Gefahrstelle konstruktiv beseitigen (z. B. Quetschstelle entfernen) | Design out the hazard point (e.g. remove a crush point) | ELIMINATION |
| 2 | Trennende Schutzeinrichtung / Verdeckung an bewegten Teilen anbringen | Fixed guard / cover on moving parts | ENGINEERING_CONTROL |
| 3 | Zwangsläufig wirkende Schutzeinrichtung (z. B. Zweihandschaltung, Lichtvorhang) | Interlocked protective device (two-hand control, light curtain) | ENGINEERING_CONTROL |
| 4 | Betriebsanweisung erstellen und Unterweisung durchführen | Issue a safe-work instruction and brief workers | ADMINISTRATIVE_CONTROL |
| 5 | Schnittschutzhandschuhe / Sicherheitsschuhe bereitstellen | Provide cut-resistant gloves / safety footwear | PPE |

### NOISE (Lärm)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Lärmärmere Arbeitsverfahren / Maschinen beschaffen | Procure quieter processes / machinery | SUBSTITUTION |
| 2 | Schallkapselung der Lärmquelle bzw. Schallschutzkabine | Enclose the source / acoustic booth | ENGINEERING_CONTROL |
| 3 | Schallabsorbierende Raumgestaltung (Absorber, Trennwände) | Acoustic room treatment (absorbers, partitions) | ENGINEERING_CONTROL |
| 4 | Expositionszeit begrenzen, Lärmbereiche kennzeichnen | Limit exposure time, mark noise areas | ADMINISTRATIVE_CONTROL |
| 5 | Gehörschutz bereitstellen und Tragepflicht durchsetzen | Provide hearing protection and enforce use | PPE |

### VIBRATION (Vibration)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Vibrationsarme Geräte / entkoppelte Werkzeuge beschaffen | Procure low-vibration / decoupled tools | SUBSTITUTION |
| 2 | Schwingungsdämpfung an Maschine/Arbeitsplatz (Dämpfer, Lagerung) | Damping at the machine/workplace | ENGINEERING_CONTROL |
| 3 | Expositionsdauer begrenzen, Tätigkeitswechsel einplanen | Limit duration, schedule job rotation | ADMINISTRATIVE_CONTROL |
| 4 | Wartung von Werkzeugen (Unwucht vermeiden) | Tool maintenance (avoid imbalance) | ADMINISTRATIVE_CONTROL |

### LIGHTING (Beleuchtung)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Beleuchtungsstärke an Sehaufgabe anpassen (Allgemein-/Platzbeleuchtung) | Match illuminance to the visual task | ENGINEERING_CONTROL |
| 2 | Blendung und Reflexe vermeiden (Leuchtenanordnung, Entblendung) | Avoid glare/reflections (luminaire layout) | ENGINEERING_CONTROL |
| 3 | Tageslichtnutzung verbessern, Wartung/Reinigung der Leuchten | Improve daylight use, maintain luminaires | ADMINISTRATIVE_CONTROL |

### CLIMATE_THERMAL (Klima / thermische Belastung)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Wärme-/Kältequelle kapseln oder abschirmen | Enclose/shield the heat/cold source | ENGINEERING_CONTROL |
| 2 | Lüftung / Klimatisierung bzw. Heizung anpassen | Adjust ventilation / HVAC | ENGINEERING_CONTROL |
| 3 | Hitze-/Kältepausen, Trinkregime, Tätigkeitswechsel | Heat/cold breaks, hydration, rotation | ADMINISTRATIVE_CONTROL |
| 4 | Angepasste (Wetter-/Hitze-)Schutzkleidung bereitstellen | Provide suitable protective clothing | PPE |

### CHEMICAL (Gefahrstoffe)
> Note: substance-specific limits (MAK/TRK/AGW) stay in the exposure catalogue — these are only the measure wordings. The full substance register is P8.
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Gefahrstoff durch ungefährlicheren Stoff ersetzen (Substitutionsprüfung) | Substitute with a less hazardous agent (substitution check) | SUBSTITUTION |
| 2 | Geschlossenes System / Absaugung an der Entstehungsstelle | Closed system / local exhaust at source | ENGINEERING_CONTROL |
| 3 | Mengen begrenzen, Expositionszeit reduzieren, Kennzeichnung/Lagerung | Limit quantities/exposure, labelling/storage | ADMINISTRATIVE_CONTROL |
| 4 | Betriebsanweisung nach Gefahrstoffrecht + Unterweisung | Chemical safe-work instruction + briefing | ADMINISTRATIVE_CONTROL |
| 5 | Geeignete PSA (Atemschutz, Chemikalienschutzhandschuhe) | Suitable PPE (RPE, chemical gloves) | PPE |

### DUST_PARTICULATE (Staub / Partikel)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Staubarme Verfahren (z. B. Nassverfahren) einsetzen | Low-dust processes (e.g. wet methods) | SUBSTITUTION |
| 2 | Absaugung an der Entstehungsstelle, Einhausung | Local exhaust at source, enclosure | ENGINEERING_CONTROL |
| 3 | Regelmäßige Reinigung (saugend, nicht aufwirbelnd) | Regular cleaning (vacuum, not sweeping) | ADMINISTRATIVE_CONTROL |
| 4 | Atemschutz der passenden Filterklasse bereitstellen | Provide RPE of the correct filter class | PPE |

### BIOLOGICAL (biologische Arbeitsstoffe)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Expositionsquelle vermeiden / Prozess schließen | Avoid the source / close the process | ELIMINATION |
| 2 | Lüftung, Flächendesinfektion, abgetrennte Bereiche | Ventilation, surface disinfection, segregation | ENGINEERING_CONTROL |
| 3 | Hygieneplan, Unterweisung, ggf. Impfangebot | Hygiene plan, briefing, vaccination offer | ADMINISTRATIVE_CONTROL |
| 4 | Schutzhandschuhe, Schutzkleidung, Atemschutz | Gloves, protective clothing, RPE | PPE |

### ERGONOMIC_MSD (Muskel-Skelett-Belastung)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Manuelle Handhabung durch Hebe-/Transporthilfen ersetzen | Replace manual handling with lifting/transport aids | ENGINEERING_CONTROL |
| 2 | Arbeitsplatz höhenverstellbar / ergonomisch gestalten | Height-adjustable / ergonomic workplace design | ENGINEERING_CONTROL |
| 3 | Lasten verringern, Greifwege optimieren, Tätigkeitswechsel | Reduce loads, optimise reach, job rotation | ADMINISTRATIVE_CONTROL |
| 4 | Unterweisung zu rückengerechtem Arbeiten | Briefing on back-friendly working | ADMINISTRATIVE_CONTROL |

### PSYCHOSOCIAL (psychische Belastung)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Arbeitsorganisation anpassen (Aufgaben-/Pausengestaltung, Handlungsspielraum) | Adjust work organisation (tasks, breaks, autonomy) | ENGINEERING_CONTROL |
| 2 | Arbeitsmenge / Termindruck steuern, Personalbemessung | Manage workload / deadline pressure, staffing | ADMINISTRATIVE_CONTROL |
| 3 | Führung/Kommunikation stärken, Konfliktmanagement | Strengthen leadership/communication, conflict management | ADMINISTRATIVE_CONTROL |
| 4 | Unterstützungsangebote (EAP, Beratung) bereitstellen | Provide support offers (EAP, counselling) | ADMINISTRATIVE_CONTROL |

> Note: PSYCHOSOCIAL measures are organisational by nature — no ELIMINATION/PPE tiers apply.

### ELECTRICAL (elektrische Gefährdungen)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Schutz durch Konstruktion (Schutzkleinspannung, Isolierung) | Protection by design (SELV, insulation) | ENGINEERING_CONTROL |
| 2 | Fehlerstrom-Schutzschalter (RCD), Abdeckungen, Not-Aus | RCD, covers, emergency stop | ENGINEERING_CONTROL |
| 3 | Elektrotechnische Prüfung, nur Elektrofachkraft, Freischalten | Electrical testing, qualified-person-only, lockout | ADMINISTRATIVE_CONTROL |
| 4 | Isolierende Schutzausrüstung bereitstellen | Provide insulating PPE | PPE |

### FIRE_EXPLOSION (Brand- / Explosionsgefahr)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Zündquellen und brennbare Stoffe vermeiden/ersetzen | Avoid/substitute ignition sources & flammables | SUBSTITUTION |
| 2 | Ex-Schutz-Zonen, Lüftung, Explosionsschutzkonzept | Ex zones, ventilation, explosion-protection concept | ENGINEERING_CONTROL |
| 3 | Brandschutzorganisation, Mengenbegrenzung, Kennzeichnung | Fire-safety organisation, quantity limits, marking | ADMINISTRATIVE_CONTROL |
| 4 | Löschmittel bereitstellen, Unterweisung/Übungen | Provide extinguishers, briefing/drills | ADMINISTRATIVE_CONTROL |

### RADIATION (Strahlung)
| # | Maßnahme (DE) | English gloss | Tier |
|---|---|---|---|
| 1 | Strahlenquelle vermeiden / schwächere Quelle einsetzen | Avoid the source / use a weaker one | SUBSTITUTION |
| 2 | Abschirmung, Abstand, geschlossene Anlagen | Shielding, distance, enclosed installations | ENGINEERING_CONTROL |
| 3 | Aufenthaltszeit begrenzen, Bereiche kennzeichnen/abgrenzen | Limit dwell time, mark/cordon areas | ADMINISTRATIVE_CONTROL |
| 4 | Geeignete PSA (z. B. UV-/Laserschutz) bereitstellen | Suitable PPE (e.g. UV/laser protection) | PPE |

---

## What I need from you

1. For each line: keep ✅ / edit the wording ✏️ / drop ✗, and add any you want.
2. Confirm the **per-category** grain is right (vs. per specific `Hazard` code), and the **German-first** wording.
3. Confirm the model/plug-in approach above.

On your sign-off I'll: add the `TypicalMeasure` catalogue (enum-first migration, RLS, active-version pattern), seed exactly the approved rows, wire the suggestion picker into the raise-action-from-finding flow (EN/DE/RO UI chrome; the measure text stays as approved), and verify end-to-end.
