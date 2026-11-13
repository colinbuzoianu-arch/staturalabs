-- P15 S5c (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S5): WGK display.
-- Substance.wgk (Wassergefährdungsklasse) — supplier-declared from the SDS
-- (section 15) on confirm, or manual. The own mixture WGK calculation is Phase 2
-- (wgk.mixtureCalculation, flag OFF). The UBA Rigoletto substance-WGK import and
-- the AT VbF flash-point classification both need official data (Rigoletto /
-- RIS), which is a founder/official step — until then WGK shows the
-- supplier-declared value and VbF shows the SDS flash point with an honest gap
-- (no threshold table loaded). Nothing seeded from recollection (§0.7/§7).
ALTER TABLE "Substance" ADD COLUMN "wgk" TEXT;
