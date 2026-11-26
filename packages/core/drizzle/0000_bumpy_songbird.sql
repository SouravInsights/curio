-- Required for the embedding column on `passages`.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "annotations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "annotations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" bigint NOT NULL,
	"library_id" bigint NOT NULL,
	"kind" text DEFAULT 'highlight' NOT NULL,
	"quote" text DEFAULT '' NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"suffix" text DEFAULT '' NOT NULL,
	"occurrence" smallint DEFAULT 0 NOT NULL,
	"start_line" integer,
	"end_line" integer,
	"hue" smallint DEFAULT 3 NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"stale" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "annotations_kind_check" CHECK ("annotations"."kind" in ('highlight','note'))
);
--> statement-breakpoint
CREATE TABLE "collection_documents" (
	"collection_id" bigint NOT NULL,
	"document_id" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_documents_unique" UNIQUE("collection_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"library_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "connections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"library_id" bigint NOT NULL,
	"from_document_id" bigint NOT NULL,
	"to_document_id" bigint NOT NULL,
	"from_annotation_id" bigint,
	"to_annotation_id" bigint,
	"kind" text DEFAULT 'related' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"library_id" bigint NOT NULL,
	"source_id" bigint,
	"kind" text DEFAULT 'article' NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"title" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"site" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"markdown" text,
	"word_count" integer,
	"content_hash" text,
	"language" text,
	"read_status" text DEFAULT 'pending' NOT NULL,
	"category" text,
	"topics" text[],
	"summary" text,
	"embedding_mode" text,
	"prompt_version" smallint,
	"analyzed_at" timestamp with time zone,
	"read_state" text DEFAULT 'unread' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_identity_unique" UNIQUE("library_id","external_id"),
	CONSTRAINT "documents_kind_check" CHECK ("documents"."kind" in ('article','newsletter','book','pdf','note','video','thread','other')),
	CONSTRAINT "documents_read_status_check" CHECK ("documents"."read_status" in ('pending','ok','thin','failed')),
	CONSTRAINT "documents_read_state_check" CHECK ("documents"."read_state" in ('unread','reading','read','archived')),
	CONSTRAINT "documents_embedding_mode_check" CHECK ("documents"."embedding_mode" in ('full','summary'))
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "libraries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"name" text DEFAULT 'My library' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "passages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" bigint NOT NULL,
	"idx" smallint NOT NULL,
	"content" text NOT NULL,
	"token_count" smallint DEFAULT 0 NOT NULL,
	"unit_type" text DEFAULT 'prose' NOT NULL,
	"heading" text,
	"start_offset" integer DEFAULT 0 NOT NULL,
	"end_offset" integer DEFAULT 0 NOT NULL,
	"start_line" integer DEFAULT 0 NOT NULL,
	"end_line" integer DEFAULT 0 NOT NULL,
	"embedding" vector(1536) NOT NULL,
	CONSTRAINT "passages_document_idx_unique" UNIQUE("document_id","idx")
);
--> statement-breakpoint
CREATE TABLE "reading_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reading_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"document_id" bigint NOT NULL,
	"library_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"library_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_documents" ADD CONSTRAINT "collection_documents_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_documents" ADD CONSTRAINT "collection_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_from_document_id_documents_id_fk" FOREIGN KEY ("from_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_to_document_id_documents_id_fk" FOREIGN KEY ("to_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_from_annotation_id_annotations_id_fk" FOREIGN KEY ("from_annotation_id") REFERENCES "public"."annotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_to_annotation_id_annotations_id_fk" FOREIGN KEY ("to_annotation_id") REFERENCES "public"."annotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_events" ADD CONSTRAINT "reading_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_events" ADD CONSTRAINT "reading_events_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "annotations_document_idx" ON "annotations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "annotations_library_idx" ON "annotations" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "collection_documents_document_idx" ON "collection_documents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "collections_library_idx" ON "collections" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "connections_library_idx" ON "connections" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "connections_from_idx" ON "connections" USING btree ("from_document_id");--> statement-breakpoint
CREATE INDEX "connections_to_idx" ON "connections" USING btree ("to_document_id");--> statement-breakpoint
CREATE INDEX "documents_library_added_idx" ON "documents" USING btree ("library_id","added_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_kind_idx" ON "documents" USING btree ("library_id","kind");--> statement-breakpoint
CREATE INDEX "documents_category_idx" ON "documents" USING btree ("library_id","category");--> statement-breakpoint
CREATE INDEX "documents_fts_idx" ON "documents" USING gin (to_tsvector('english', "markdown"));--> statement-breakpoint
CREATE INDEX "libraries_user_idx" ON "libraries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passages_document_idx" ON "passages" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "passages_embedding_hnsw_idx" ON "passages" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "passages_fts_idx" ON "passages" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE INDEX "reading_events_document_idx" ON "reading_events" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "reading_events_library_created_idx" ON "reading_events" USING btree ("library_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sources_library_idx" ON "sources" USING btree ("library_id");