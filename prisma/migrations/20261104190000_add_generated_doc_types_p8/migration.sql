-- P8 §3.2/§3.3: two new generated-document types. Enum-add only (gotcha).
ALTER TYPE "GeneratedDocumentType" ADD VALUE 'BETRIEBSANWEISUNG';
ALTER TYPE "GeneratedDocumentType" ADD VALUE 'GEFAHRSTOFFVERZEICHNIS';
