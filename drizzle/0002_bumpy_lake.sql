CREATE TABLE "service_payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"operation_key" uuid NOT NULL,
	"instruction_hash" text NOT NULL,
	"challenge" jsonb NOT NULL,
	"state" text DEFAULT 'quoted' NOT NULL,
	"payer" text,
	"payload_hash" text,
	"digest" text,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"intent_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"network" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_payment_intents" ADD CONSTRAINT "service_payment_intents_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_payment_intents" ADD CONSTRAINT "service_payment_intents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_payment_receipts" ADD CONSTRAINT "service_payment_receipts_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_payment_receipts" ADD CONSTRAINT "service_payment_receipts_intent_id_service_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."service_payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_operation" ON "service_payment_intents" USING btree ("tenant_id","operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "service_payload_once" ON "service_payment_intents" USING btree ("payload_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "service_digest_once" ON "service_payment_intents" USING btree ("digest");--> statement-breakpoint
CREATE UNIQUE INDEX "service_receipt_intent" ON "service_payment_receipts" USING btree ("intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_receipt_digest" ON "service_payment_receipts" USING btree ("network","digest");