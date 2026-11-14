-- P16 §4 slice 5: a document type for the watermarked SDS draft preview. The value
-- is not referenced within this migration (runtime use only), so adding it alone is
-- safe (PG allows ALTER TYPE ADD VALUE here; it just can't be USED in the same tx).
ALTER TYPE "GeneratedDocumentType" ADD VALUE 'SDS_DRAFT_PREVIEW';
