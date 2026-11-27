ALTER TABLE "annotations" ADD COLUMN "client_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "annotations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "annotations" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "annotations_library_sync_idx" ON "annotations" USING btree ("library_id","updated_at","id");--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_client_id_unique" UNIQUE("client_id");