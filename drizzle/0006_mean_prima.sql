CREATE TABLE IF NOT EXISTS "service_spending_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"network" text NOT NULL,
	"asset" text NOT NULL,
	"payer" text NOT NULL,
	"reserved_atomic" numeric(38, 0) DEFAULT '0' NOT NULL,
	"cap_atomic" numeric(38, 0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_payment_intents" ADD COLUMN IF NOT EXISTS "spending_session_id" text;--> statement-breakpoint
ALTER TABLE "service_payment_intents" ADD COLUMN IF NOT EXISTS "approval" jsonb;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_spending_sessions_tenant_id_users_id_fk') THEN
    ALTER TABLE "service_spending_sessions" ADD CONSTRAINT "service_spending_sessions_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
