CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_key" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'Computer' NOT NULL,
	"platform" text DEFAULT 'Sconosciuto' NOT NULL,
	"browser" text DEFAULT 'Browser' NOT NULL,
	"address" text,
	"local_ip" text,
	"mac_address" text,
	"user_agent" text,
	"screen_sharing" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_key_unique" UNIQUE("device_key")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"uploaded_by" text NOT NULL,
	"target_device" text,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_device_key" text NOT NULL,
	"to_device_key" text NOT NULL,
	"type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "devices_last_seen_idx" ON "devices" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "signals_target_idx" ON "signals" USING btree ("to_device_key","id");--> statement-breakpoint
CREATE INDEX "signals_created_at_idx" ON "signals" USING btree ("created_at");