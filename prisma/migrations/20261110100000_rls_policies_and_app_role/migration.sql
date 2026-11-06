-- P13 §1: RLS policies + a non-owning application role. Closes CLAUDE.md's
-- standing hardening item — RLS was enabled on every table but had no policies,
-- which only held because the runtime role OWNS the tables and bypasses RLS.
--
-- Model: a session GUC `app.company_ids` (comma-separated company ids the
-- session may see) drives visibility at the tenant roots; every descendant
-- inherits visibility through its parent FK (a policy's EXISTS subquery is
-- itself subject to the parent's RLS, so visibility composes transitively);
-- shared reference/catalogue tables are readable by all app sessions. The
-- OWNER (migrations/seed via DIRECT_URL) bypasses RLS entirely (no FORCE), so
-- this changes nothing for migrations or for today's owner-connected runtime —
-- it only bites once the runtime connects as the non-owning `statura_app`
-- role (the staging rollout, SLD_P13_RLS_ROLLOUT.md), which is why it is safe
-- to land now and verify behind that switch.
--
-- Defence in depth: these policies MIRROR the app's require*Access logic at the
-- DB level; they do not replace it.

-- 1. The non-owning application role. NOLOGIN for now (the real login +
--    password is a staging/infra step); granted to the current owner so this
--    migration — and the proof test — can SET ROLE to it to exercise RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'statura_app') THEN
    CREATE ROLE statura_app NOLOGIN;
  END IF;
END $$;
GRANT statura_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO statura_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO statura_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO statura_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO statura_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO statura_app;

-- 2. The GUC reader. STABLE; unset GUC -> NULL -> fail-closed (ANY(NULL) -> no
--    rows). The `true` second arg means "missing is not an error".
CREATE OR REPLACE FUNCTION app_company_ids() RETURNS text[]
  LANGUAGE sql STABLE AS $$
  SELECT string_to_array(current_setting('app.company_ids', true), ',')
$$;

-- 3. Generate one policy per table, named app_rls, FOR ALL TO statura_app.
DO $$
DECLARE
  global_tables text[] := ARRAY[
    'ExposureLimit','ExposureLimitCatalogVersion','HoldTimeRule',
    'IncidentNotificationCatalogVersion','IncidentNotificationRule',
    'KpiCatalogVersion','KpiDefinition','LegalReference',
    'LegalReferenceCatalogVersion','LegalRequirementCatalogVersion',
    'ManualHandlingRule','MethodologyVersion','PostureZoneRule','RepetitionRule',
    'RetentionRule','RetentionRuleCatalogVersion','RiskMatrixCell',
    'RiskMatrixVersion','ScoringRule','TypicalMeasure','TypicalMeasureCatalogVersion'
  ];
  company_tables text[] := ARRAY[
    'AuditEvent','CompanyModule','CompanyRetentionConfig','CompanyRetentionSetting',
    'Document','EnvironmentalAspect','GeneratedDocument','Hazard','Incident',
    'IncidentRetentionBatch','InspectionTemplate','LegalRequirement','Notification',
    'Person','PlatformUser','RetentionBatch','Site','Substance',
    'SubstanceRetentionBatch','TrainingRequirementType','TrainingSession'
  ];
  site_tables text[] := ARRAY[
    'Action','EnvironmentalAssessment','FloorPlan','Inspection','OperatingInstruction',
    'OrgUnit','Process','RiskAssessment','SiteAssignment','SiteLegalRequirement',
    'SitePeriodFigures','SubstanceUse','WasteStream','Workstation'
  ];
  t text;
  changed boolean;
  parent_table text;
  fk_col text;
BEGIN
  -- Shared reference/catalogue tables: visible to every app session (not tenant
  -- data). Activation stays super_admin-only at the app layer (ERGO §3.14).
  FOREACH t IN ARRAY global_tables LOOP
    EXECUTE format('CREATE POLICY app_rls ON %I FOR ALL TO statura_app USING (true) WITH CHECK (true)', t);
  END LOOP;

  -- Tenant root: a session sees only its own company.
  EXECUTE 'CREATE POLICY app_rls ON "Company" FOR ALL TO statura_app USING (id = ANY(app_company_ids())) WITH CHECK (id = ANY(app_company_ids()))';

  -- company-scoped: own company, OR a system row (companyId NULL = shared
  -- catalogue, e.g. system Hazards / InspectionTemplates).
  FOREACH t IN ARRAY company_tables LOOP
    EXECUTE format('CREATE POLICY app_rls ON %I FOR ALL TO statura_app USING ("companyId" IS NULL OR "companyId" = ANY(app_company_ids())) WITH CHECK ("companyId" IS NULL OR "companyId" = ANY(app_company_ids()))', t);
  END LOOP;

  -- site-scoped: the site must be visible (Site RLS filters the subquery).
  FOREACH t IN ARRAY site_tables LOOP
    EXECUTE format('CREATE POLICY app_rls ON %I FOR ALL TO statura_app USING (EXISTS (SELECT 1 FROM "Site" s WHERE s.id = %I."siteId")) WITH CHECK (EXISTS (SELECT 1 FROM "Site" s WHERE s.id = %I."siteId"))', t, t, t);
  END LOOP;

  -- Fixpoint: every remaining table inherits visibility through a FK to an
  -- already-policied, tenant-scoped (non-global) parent. Repeated passes handle
  -- multi-hop chains (Task -> Workstation, PostureSample -> Task, ...).
  LOOP
    changed := false;
    FOR t IN
      SELECT tablename FROM pg_tables
      WHERE schemaname='public' AND tablename NOT LIKE E'\\_prisma%'
        AND NOT EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname='public' AND pp.tablename=pg_tables.tablename AND pp.policyname='app_rls')
    LOOP
      SELECT ccu.table_name, kcu.column_name
        INTO parent_table, fk_col
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name=ccu.constraint_name AND tc.table_schema=ccu.table_schema
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
        AND tc.table_name=t
        AND ccu.column_name='id'
        AND ccu.table_name <> t
        AND ccu.table_name <> ALL(global_tables)
        AND EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=ccu.table_name AND p.policyname='app_rls')
      LIMIT 1;
      IF parent_table IS NOT NULL THEN
        EXECUTE format('CREATE POLICY app_rls ON %I FOR ALL TO statura_app USING (EXISTS (SELECT 1 FROM %I p WHERE p.id = %I.%I)) WITH CHECK (EXISTS (SELECT 1 FROM %I p WHERE p.id = %I.%I))', t, parent_table, t, fk_col, parent_table, t, fk_col);
        changed := true;
      END IF;
      parent_table := NULL;
    END LOOP;
    EXIT WHEN NOT changed;
  END LOOP;

  -- Leftovers: no FK to a tenant-scoped parent (e.g. loose-uuid links). Default
  -- to shared-read with a NOTICE so the gap is visible in the migrate output
  -- and can be tightened on the staging rollout.
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND tablename NOT LIKE E'\\_prisma%'
      AND NOT EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname='public' AND pp.tablename=pg_tables.tablename AND pp.policyname='app_rls')
  LOOP
    RAISE NOTICE 'RLS app_rls: no tenant-scoped parent for %, defaulting to shared-read', t;
    EXECUTE format('CREATE POLICY app_rls ON %I FOR ALL TO statura_app USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
