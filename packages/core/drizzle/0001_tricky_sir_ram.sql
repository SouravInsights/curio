DROP INDEX "libraries_user_idx";--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_user_unique" UNIQUE("user_id");