ALTER TABLE "libraries" ADD COLUMN "suggestions" text[];--> statement-breakpoint
ALTER TABLE "libraries" ADD COLUMN "suggestions_updated_at" timestamp with time zone;