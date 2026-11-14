-- P16 §4 slice 4: numeric physical properties per mixture component, so the
-- physical-estimates engine can run on real product data (density/flash/boiling)
-- rather than on unparsed verbatim strings. Auto-filled from the linked
-- ReferenceSubstance (PubChem) on composition autofill, or set by the demo seed.
ALTER TABLE "MixtureComponent" ADD COLUMN "densityGCm3"   DOUBLE PRECISION;
ALTER TABLE "MixtureComponent" ADD COLUMN "flashPointC"   DOUBLE PRECISION;
ALTER TABLE "MixtureComponent" ADD COLUMN "boilingPointC" DOUBLE PRECISION;
