-- P13 §2.2: editable default entitlement template for new tenants.
CREATE TABLE "DefaultEntitlementModule" (
    "moduleKey" "ModuleKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DefaultEntitlementModule_pkey" PRIMARY KEY ("moduleKey")
);
ALTER TABLE "DefaultEntitlementModule" ENABLE ROW LEVEL SECURITY;
-- shared/global reference-ish (super-admin managed); readable by app sessions.
CREATE POLICY app_rls ON "DefaultEntitlementModule" FOR ALL TO statura_app USING (true) WITH CHECK (true);
-- Default on-set: the entitlement-requiring starter modules (baseline modules
-- cockpit/my-tasks/actions/documents/settings are always on and not listed).
INSERT INTO "DefaultEntitlementModule" ("moduleKey") VALUES ('RISK'), ('REPORTS')
ON CONFLICT DO NOTHING;
