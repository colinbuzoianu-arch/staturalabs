-- CreateTable
CREATE TABLE "MethodologyVersion" (
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MethodologyVersion_pkey" PRIMARY KEY ("version")
);

-- CreateIndex
-- Partial unique index: at most one row may have isActive = true. Prisma's
-- schema language can't express this (no filtered/partial index support),
-- so it's hand-added here — see the model doc comment in schema.prisma.
CREATE UNIQUE INDEX "MethodologyVersion_isActive_unique_when_true" ON "MethodologyVersion"("isActive") WHERE "isActive" = true;

ALTER TABLE "MethodologyVersion" ENABLE ROW LEVEL SECURITY;

-- Seed: the only methodology version that exists today, marked active.
-- Inserted before the FK below is added, since ScoringRule already has 26
-- rows referencing 'v1-2026-07' — the parent row must exist first.
INSERT INTO "MethodologyVersion" ("version", "isActive", "activatedAt") VALUES ('v1-2026-07', true, CURRENT_TIMESTAMP);

-- AddForeignKey
-- Safe to add now (not NOT VALID): every existing ScoringRule row already
-- has methodologyVersion = 'v1-2026-07', which now exists in the parent
-- table, so Postgres's validation of existing rows against this constraint
-- passes without a separate backfill step.
ALTER TABLE "ScoringRule" ADD CONSTRAINT "ScoringRule_methodologyVersion_fkey" FOREIGN KEY ("methodologyVersion") REFERENCES "MethodologyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
