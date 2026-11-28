DROP TABLE IF EXISTS "sources" CASCADE;--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_embedding_mode_check";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "source_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "published_at";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "language";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "embedding_mode";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "analyzed_at";
