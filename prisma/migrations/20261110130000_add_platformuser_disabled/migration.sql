-- P13 §2.4/§6: immediate account disable (reversible, keeps the row).
ALTER TABLE "PlatformUser" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "PlatformUser" ADD COLUMN "disabledByUserId" UUID;
