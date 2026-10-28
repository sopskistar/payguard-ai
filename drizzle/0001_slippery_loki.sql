CREATE TABLE "human_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"instruction_hash" text NOT NULL,
	"profile_revision" integer NOT NULL,
	"outcome" text NOT NULL,
	"method" text NOT NULL,
	"note" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_instructions" (
	"invoice_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sender_email" text NOT NULL,
	"reply_to" text NOT NULL,
	"message" text NOT NULL,
	"requested_contact" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_trust_profiles" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trusted_recipient" text NOT NULL,
	"email_domain" text NOT NULL,
	"contact_label" text NOT NULL,
	"contact_method" text NOT NULL,
	"contact_reference" text NOT NULL,
	"established_at" timestamp with time zone NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "human_verifications" ADD CONSTRAINT "human_verifications_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_verifications" ADD CONSTRAINT "human_verifications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_instructions" ADD CONSTRAINT "payment_instructions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_instructions" ADD CONSTRAINT "payment_instructions_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_trust_profiles" ADD CONSTRAINT "vendor_trust_profiles_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_trust_profiles" ADD CONSTRAINT "vendor_trust_profiles_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "human_verification_invoice" ON "human_verifications" USING btree ("tenant_id","invoice_id");