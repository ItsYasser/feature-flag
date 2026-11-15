CREATE TYPE "public"."environment" AS ENUM('dev', 'staging', 'prod');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"flag_id" integer,
	"environment" "environment" NOT NULL,
	"client_id" text,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text DEFAULT '' NOT NULL,
	"version" bigint NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flag_defaults" (
	"flag_id" integer NOT NULL,
	"environment" "environment" NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "flag_defaults_flag_id_environment_pk" PRIMARY KEY("flag_id","environment")
);
--> statement-breakpoint
CREATE TABLE "flag_overrides" (
	"flag_id" integer NOT NULL,
	"environment" "environment" NOT NULL,
	"client_id" text NOT NULL,
	"enabled" boolean NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flag_overrides_flag_id_environment_client_id_pk" PRIMARY KEY("flag_id","environment","client_id")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"owner_team" text NOT NULL,
	"status" "flag_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ruleset_version" (
	"environment" "environment" PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_flag_id_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_defaults" ADD CONSTRAINT "flag_defaults_flag_id_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_overrides" ADD CONSTRAINT "flag_overrides_flag_id_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_flag_idx" ON "audit_log" USING btree ("flag_id","id");