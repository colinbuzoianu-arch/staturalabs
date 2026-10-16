-- H1b of the hazards-and-environment plan
-- (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §3.2): expand the
-- system hazard catalogue from ~15 rows to 5-8 per HazardCategory, plus one
-- "-99 / Sonstige Gefährdung (beschreiben)" fallback row per category so an
-- assessor always has a usable option without needing a company admin to
-- add one (picking a -99 hazard requires `notes`, enforced server-side —
-- see src/lib/risk/hazard-catalog.ts).
--
-- Names are written fresh for SLD — NOT copied from AUVA/LMM/EAWS wording
-- (ERGO_COMPLIANCE_BY_DESIGN.md §3.7) — and carry NO legal numbers or
-- statutory references in their descriptions (§3.2: legal values belong in
-- ExposureLimit, not the catalogue). English to match the existing seeded
-- catalogue (hazard names are stored data rendered verbatim, not translated
-- — HazardCategory *labels* are what the dashboard/SGD translate). The -99
-- rows are deliberately the one German string, per the plan's explicit
-- "Sonstige Gefährdung (beschreiben)" wording and the Austria-first UI.
--
-- companyId = NULL, isSystem = true (system catalogue, super_admin-writable
-- only). Existing MECH-01/02, NOISE-01, ... rows from
-- 20260730120300_add_risk_core are left untouched; this only adds.
-- Pending founder review of the specific names (they are data, easily
-- revised in a follow-up migration — not legal values).

INSERT INTO "Hazard" ("id", "companyId", "category", "code", "name", "description", "isSystem", "updatedAt") VALUES
  -- PHYSICAL_MECHANICAL
  (gen_random_uuid()::text, NULL, 'PHYSICAL_MECHANICAL', 'MECH-03', 'Slip, trip and fall on the level', 'Wet or contaminated floors, spills, trailing cables or uneven surfaces in walkways and work areas.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PHYSICAL_MECHANICAL', 'MECH-04', 'Fall from height', 'Work on platforms, ladders, mezzanines or near unprotected edges and floor openings.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PHYSICAL_MECHANICAL', 'MECH-05', 'Falling or toppling objects', 'Stacked material, racking loads or overhead items that can fall or topple onto people below.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PHYSICAL_MECHANICAL', 'MECH-06', 'Powered vehicle and forklift traffic', 'Collision or crushing risk where pedestrians share routes with forklifts or other mobile plant.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PHYSICAL_MECHANICAL', 'MECH-07', 'Sharp edges and protruding parts', 'Cut or puncture injury from sheet edges, swarf, fixtures or protruding machine parts.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PHYSICAL_MECHANICAL', 'MECH-08', 'Uncontrolled stored energy', 'Unexpected release of energy from hydraulics, pneumatics, springs or suspended loads during work or maintenance.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PHYSICAL_MECHANICAL', 'MECH-99', 'Sonstige Gefährdung (beschreiben)', 'Other physical/mechanical hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- NOISE
  (gen_random_uuid()::text, NULL, 'NOISE', 'NOISE-02', 'Impulse noise from presses and impacts', 'Short high-level noise peaks from stamping, forging, hammering or other impact operations.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'NOISE', 'NOISE-03', 'Noise masking communication or warning signals', 'Background noise high enough to impair speech communication or the audibility of alarms and warning signals.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'NOISE', 'NOISE-04', 'Hand-tool and compressed-air noise', 'Localized high noise from powered hand tools, air blow-off or compressed-air exhausts.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'NOISE', 'NOISE-05', 'Reverberation in hard-surfaced areas', 'Hard room surfaces raising the overall sound pressure level across a work area.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'NOISE', 'NOISE-99', 'Sonstige Gefährdung (beschreiben)', 'Other noise hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- VIBRATION
  (gen_random_uuid()::text, NULL, 'VIBRATION', 'VIB-02', 'Whole-body vibration', 'Vibration transmitted through the seat or feet when operating forklifts, mobile plant or vibrating platforms.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'VIBRATION', 'VIB-03', 'Vibration from fixed machinery', 'Sustained hand or body contact with vibrating benches, moulds, feeders or compactors.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'VIBRATION', 'VIB-04', 'Prolonged grip on vibrating workpieces', 'Holding parts against powered abrasive or percussive tools, transmitting vibration to the hand-arm system.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'VIBRATION', 'VIB-99', 'Sonstige Gefährdung (beschreiben)', 'Other vibration hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- LIGHTING
  (gen_random_uuid()::text, NULL, 'LIGHTING', 'LIGHT-02', 'Glare and reflections', 'Direct or reflected glare impairing visual comfort or the visibility of the task.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'LIGHTING', 'LIGHT-03', 'Flicker from lighting or displays', 'Perceptible flicker causing visual fatigue, or stroboscopic effects making moving machinery appear stationary.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'LIGHTING', 'LIGHT-04', 'Missing or inadequate emergency lighting', 'Insufficient illumination of escape routes and critical areas on loss of normal power.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'LIGHTING', 'LIGHT-05', 'No daylight or outside visual contact', 'Workplaces lacking daylight provision or visual contact with the outside where these are expected.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'LIGHTING', 'LIGHT-99', 'Sonstige Gefährdung (beschreiben)', 'Other lighting hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- CLIMATE_THERMAL
  (gen_random_uuid()::text, NULL, 'CLIMATE_THERMAL', 'THERM-02', 'Outdoor heat and solar load', 'Work in direct sun or high outdoor temperatures with a risk of heat strain.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CLIMATE_THERMAL', 'THERM-03', 'Cold working environment', 'Work in cold stores, chilled areas or outdoors in winter conditions.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CLIMATE_THERMAL', 'THERM-04', 'Draught and local air movement', 'Localized cold air streams causing discomfort or muscular strain at the workplace.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CLIMATE_THERMAL', 'THERM-05', 'High humidity', 'Moisture load impairing thermal comfort or the body''s ability to dissipate heat.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CLIMATE_THERMAL', 'THERM-99', 'Sonstige Gefährdung (beschreiben)', 'Other climate/thermal hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- CHEMICAL
  (gen_random_uuid()::text, NULL, 'CHEMICAL', 'CHEM-03', 'Cleaning and degreasing agents', 'Skin or inhalation exposure to industrial cleaning and degreasing products.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CHEMICAL', 'CHEM-04', 'Oils, coolants and lubricants', 'Dermal exposure to metalworking fluids, oils or lubricants, with a risk of dermatitis.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CHEMICAL', 'CHEM-05', 'CMR substances', 'Handling of carcinogenic, mutagenic or reprotoxic substances.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CHEMICAL', 'CHEM-06', 'Process gases and fumes', 'Gases, vapours or fumes released by heating, welding or chemical processes.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CHEMICAL', 'CHEM-07', 'Compressed and liquefied gases', 'Leakage or uncontrolled release from gas cylinders and supply systems.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'CHEMICAL', 'CHEM-99', 'Sonstige Gefährdung (beschreiben)', 'Other chemical hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- DUST_PARTICULATE
  (gen_random_uuid()::text, NULL, 'DUST_PARTICULATE', 'DUST-02', 'Hardwood dust', 'Carcinogenic hardwood dust generated by cutting, sanding or machining hardwoods.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'DUST_PARTICULATE', 'DUST-03', 'Quartz and mineral dust', 'Respirable crystalline silica and mineral dust from stone, concrete or mineral processing.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'DUST_PARTICULATE', 'DUST-04', 'Welding and metal fume', 'Fine metal particulate from welding, cutting and thermal metal processes.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'DUST_PARTICULATE', 'DUST-05', 'General inhalable dust', 'Inhalable or nuisance dust from handling bulk material, sweeping or housekeeping.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'DUST_PARTICULATE', 'DUST-99', 'Sonstige Gefährdung (beschreiben)', 'Other dust/particulate hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- BIOLOGICAL
  (gen_random_uuid()::text, NULL, 'BIOLOGICAL', 'BIO-02', 'Contaminated water aerosols (Legionella)', 'Aerosol release from cooling systems, humidifiers or coolant where microbial growth can occur.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'BIOLOGICAL', 'BIO-03', 'Mould on materials or surfaces', 'Fungal growth on stored materials, building surfaces or ventilation components.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'BIOLOGICAL', 'BIO-04', 'Waste and organic material handling', 'Exposure to microorganisms when handling waste, organic residues or contaminated materials.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'BIOLOGICAL', 'BIO-05', 'Blood and body-fluid contact (first aid)', 'Incidental exposure to blood or body fluids during first aid or clean-up.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'BIOLOGICAL', 'BIO-99', 'Sonstige Gefährdung (beschreiben)', 'Other biological hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- ERGONOMIC_MSD
  (gen_random_uuid()::text, NULL, 'ERGONOMIC_MSD', 'ERGO-02', 'Lifting and carrying loads', 'Manual lifting, holding or carrying of heavy or bulky loads.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ERGONOMIC_MSD', 'ERGO-03', 'Pushing and pulling', 'Moving trolleys, carts or loads by hand, including starting and stopping forces.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ERGONOMIC_MSD', 'ERGO-04', 'Repetitive movements', 'High-frequency repetitive hand and arm actions over the working period.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ERGONOMIC_MSD', 'ERGO-05', 'Prolonged standing or sitting', 'Sustained static standing or sitting posture over the shift.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ERGONOMIC_MSD', 'ERGO-06', 'Display-screen (VDU) work', 'Sustained screen work with associated visual and postural strain.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ERGONOMIC_MSD', 'ERGO-99', 'Sonstige Gefährdung (beschreiben)', 'Other ergonomic/MSD hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- PSYCHOSOCIAL (recorded at job/workstation level only, never per respondent — §3.12)
  (gen_random_uuid()::text, NULL, 'PSYCHOSOCIAL', 'PSYCH-03', 'Time pressure and high work pace', 'Tight deadlines or machine/line-paced work. Recorded at job/workstation level only, never per respondent.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PSYCHOSOCIAL', 'PSYCH-04', 'Monotony and low task variety', 'Repetitive, low-variety work with little control over how it is done. Recorded at job/workstation level only, never per respondent.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PSYCHOSOCIAL', 'PSYCH-05', 'Lone working', 'Working alone without ready contact with or assistance from others. Recorded at job/workstation level only, never per respondent.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PSYCHOSOCIAL', 'PSYCH-06', 'Conflict with customers or third parties', 'Emotionally demanding contact or aggression risk from customers, patients or the public. Recorded at job/workstation level only, never per respondent.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'PSYCHOSOCIAL', 'PSYCH-99', 'Sonstige Gefährdung (beschreiben)', 'Other psychosocial hazard not covered by the list above — describe it in the finding notes. Recorded at job/workstation level only, never per respondent.', true, CURRENT_TIMESTAMP),

  -- ELECTRICAL
  (gen_random_uuid()::text, NULL, 'ELECTRICAL', 'ELEC-02', 'Work near live parts', 'Tasks performed close to energized equipment or conductors.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ELECTRICAL', 'ELEC-03', 'Defective portable equipment and cabling', 'Damaged leads, plugs, extension cords or portable powered tools.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ELECTRICAL', 'ELEC-04', 'Static discharge', 'Electrostatic build-up and discharge in dry environments or sensitive process areas.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ELECTRICAL', 'ELEC-05', 'Equipment overdue for electrical inspection', 'Fixed or portable electrical equipment past its required inspection/test interval.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ELECTRICAL', 'ELEC-99', 'Sonstige Gefährdung (beschreiben)', 'Other electrical hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- FIRE_EXPLOSION
  (gen_random_uuid()::text, NULL, 'FIRE_EXPLOSION', 'FIRE-02', 'Flammable liquids and gases', 'Storage or use of flammable liquids or gases creating a fire or explosion risk.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'FIRE_EXPLOSION', 'FIRE-03', 'Hot work (welding, cutting, grinding)', 'Ignition sources from hot work carried out near combustible materials.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'FIRE_EXPLOSION', 'FIRE-04', 'Blocked or inadequate escape routes', 'Obstructed exits, locked escape doors or insufficient escape-route provision.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'FIRE_EXPLOSION', 'FIRE-05', 'Missing or unserviced fire-fighting equipment', 'Absent, unsuitable or overdue extinguishers, hydrants or suppression systems.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'FIRE_EXPLOSION', 'FIRE-99', 'Sonstige Gefährdung (beschreiben)', 'Other fire/explosion hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP),

  -- RADIATION
  (gen_random_uuid()::text, NULL, 'RADIATION', 'RAD-02', 'Laser radiation', 'Exposure from laser cutting, marking, measuring or alignment devices.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'RADIATION', 'RAD-03', 'Infrared radiation from hot surfaces', 'Radiant heat from molten material, hot process surfaces or open flames.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'RADIATION', 'RAD-04', 'Electromagnetic fields', 'Fields from induction heating, large transformers, RF or microwave equipment.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'RADIATION', 'RAD-05', 'Ionising radiation sources', 'Exposure from gauges, analysers or other devices containing radioactive sources.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'RADIATION', 'RAD-99', 'Sonstige Gefährdung (beschreiben)', 'Other radiation hazard not covered by the list above — describe it in the finding notes.', true, CURRENT_TIMESTAMP);
