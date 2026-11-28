ALTER TABLE "documents" ADD COLUMN "read_progress" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "last_read_at" timestamp with time zone;