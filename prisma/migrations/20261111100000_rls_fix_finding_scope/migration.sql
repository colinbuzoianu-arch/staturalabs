-- P13 §1 correctness fix: two RLS policies scoped a child through a
-- SHARED-CAPABLE catalogue parent, defeating tenant isolation.
--
-- The 20261110100000 fixpoint excluded `global_tables` when choosing a scoping
-- parent, but NOT the company-scoped catalogue tables whose policy permits
-- `companyId IS NULL` (system rows visible to every tenant): Hazard,
-- EnvironmentalAspect, etc. A child that references the SYSTEM row of such a
-- parent (the common case) then becomes visible to every tenant, because the
-- EXISTS() resolves against a row everyone can see — the child's own ownership
-- never enters the predicate.
--
--   RiskFinding        scoped through Hazard            (system hazards: 84 NULL rows)
--   EnvironmentalFinding scoped through EnvironmentalAspect (39 NULL rows)
--
-- Both have a proper, strictly tenant-bound parent — their assessment, which is
-- site-scoped (EXISTS Site -> company). Re-point the policies there. Proven
-- live: before this, a statura_app session scoped to company X could DELETE
-- company Y's findings; after, it cannot.
--
-- (InspectionTemplateSection->InspectionTemplate and RoleAssignment->PlatformUser
-- also touch shared-capable parents, but there the parent is per-ROW tenant-bound
-- — a company template / a company user is NOT visible cross-tenant, and only the
-- legitimately-shared system template sections / platform-operator assignments
-- are cross-visible — so those are left as-is.)

DROP POLICY IF EXISTS app_rls ON "RiskFinding";
CREATE POLICY app_rls ON "RiskFinding" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "RiskAssessment" p WHERE p.id = "RiskFinding"."riskAssessmentId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "RiskAssessment" p WHERE p.id = "RiskFinding"."riskAssessmentId"));

DROP POLICY IF EXISTS app_rls ON "EnvironmentalFinding";
CREATE POLICY app_rls ON "EnvironmentalFinding" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "EnvironmentalAssessment" p WHERE p.id = "EnvironmentalFinding"."environmentalAssessmentId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "EnvironmentalAssessment" p WHERE p.id = "EnvironmentalFinding"."environmentalAssessmentId"));
