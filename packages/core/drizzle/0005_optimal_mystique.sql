ALTER TABLE "annotations" ADD COLUMN "review_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "annotations" ADD COLUMN "review_interval" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "annotations" ADD COLUMN "review_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "annotations" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "annotations_review_idx" ON "annotations" USING btree ("library_id","review_due_at");