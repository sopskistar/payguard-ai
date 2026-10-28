import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  numeric,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { Preferences, Finding, Policy } from '@/lib/types';
const time = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  role: text('role').notNull().default('owner'),
  settings: jsonb('settings').$type<Preferences>().notNull(),
  createdAt: time(),
});
const tenant = () =>
  uuid('tenant_id')
    .notNull()
    .references(() => users.id);
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  tenantId: tenant(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: time(),
});
export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: time(),
  },
  (t) => [uniqueIndex('vendor_identity').on(t.tenantId, t.normalizedName, t.isDemo)],
);
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id),
    number: text('number').notNull(),
    issued: text('issued').notNull(),
    due: text('due').notNull(),
    amount: numeric('amount', { precision: 38, scale: 18 }).notNull(),
    currency: text('currency').notNull(),
    memo: text('memo').notNull().default(''),
    recipient: text('recipient').notNull().default(''),
    wallet: text('wallet').notNull().default(''),
    coinType: text('coin_type').notNull().default(''),
    tokenAmount: text('token_amount').notNull().default(''),
    status: text('status').notNull().default('open'),
    source: text('source').notNull().default('manual'),
    importKey: text('import_key').notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: time(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('invoice_import').on(t.tenantId, t.importKey),
    index('invoice_tenant_vendor').on(t.tenantId, t.vendorId),
  ],
);
export const invoiceFiles = pgTable('invoice_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenant(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  sha256: text('sha256').notNull(),
  size: integer('size').notNull(),
  outcome: text('outcome').notNull(),
  metadata: jsonb('metadata').notNull(),
  createdAt: time(),
});
export const watchedWallets = pgTable(
  'watched_wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    address: text('address').notNull(),
    label: text('label').notNull(),
    balance: text('balance'),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }),
    createdAt: time(),
  },
  (t) => [uniqueIndex('wallet_identity').on(t.tenantId, t.address)],
);
export const paymentCandidates = pgTable(
  'payment_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    digest: text('digest').notNull(),
    status: text('status').notNull().default('candidate'),
    evidence: jsonb('evidence').notNull(),
    createdAt: time(),
  },
  (t) => [index('candidate_tenant').on(t.tenantId)],
);
export const paymentMatches = pgTable(
  'payment_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    digest: text('digest').notNull(),
    network: text('network').notNull(),
    evidence: jsonb('evidence').notNull(),
    createdAt: time(),
  },
  (t) => [
    uniqueIndex('unique_digest_per_tenant').on(t.tenantId, t.network, t.digest),
    uniqueIndex('unique_invoice_payment').on(t.tenantId, t.invoiceId),
  ],
);
export const riskFindings = pgTable('risk_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenant(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  memoryOn: boolean('memory_on').notNull(),
  assessment: jsonb('assessment').notNull(),
  findings: jsonb('findings').$type<Finding[]>().notNull(),
  createdAt: time(),
});
export const reviewDecisions = pgTable('review_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenant(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  findingId: text('finding_id').notNull(),
  explanation: text('explanation').notNull(),
  scope: text('scope').notNull(),
  future: boolean('future').notNull(),
  createdAt: time(),
});
export const userRules = pgTable('user_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenant(),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  decisionId: uuid('decision_id').references(() => reviewDecisions.id),
  policy: jsonb('policy').$type<Policy>().notNull(),
  createdAt: time(),
});
export const memoryJobs = pgTable(
  'memory_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    policyId: uuid('policy_id').references(() => userRules.id),
    operationKey: text('operation_key').notNull(),
    namespace: text('namespace').notNull(),
    intent: text('intent').notNull(),
    text: text('text').notNull(),
    jobId: text('job_id'),
    blobId: text('blob_id'),
    accountId: text('account_id'),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    isDemo: boolean('is_demo').notNull().default(false),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    createdAt: time(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('memory_operation').on(t.tenantId, t.operationKey),
    index('memory_tenant_status').on(t.tenantId, t.status),
  ],
);
export const memoryRecallEvents = pgTable('memory_recall_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenant(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  query: text('query').notNull(),
  memoryIds: jsonb('memory_ids').$type<string[]>().notNull(),
  status: text('status').notNull(),
  createdAt: time(),
});
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    type: text('type').notNull(),
    entityId: text('entity_id'),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull(),
    createdAt: time(),
  },
  (t) => [index('audit_tenant_time').on(t.tenantId, t.createdAt)],
);
export const demoScenarios = pgTable(
  'demo_scenarios',
  {
    tenantId: tenant(),
    key: text('key').notNull(),
    state: jsonb('state').notNull(),
    createdAt: time(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
// Additive Verify migration: canonical trust anchors and human attestations remain in Neon.
export const vendorTrustProfiles = pgTable('vendor_trust_profiles', {
  vendorId: uuid('vendor_id')
    .primaryKey()
    .references(() => vendors.id),
  tenantId: tenant(),
  trustedRecipient: text('trusted_recipient').notNull(),
  emailDomain: text('email_domain').notNull(),
  contactLabel: text('contact_label').notNull(),
  contactMethod: text('contact_method').notNull(),
  contactReference: text('contact_reference').notNull(),
  establishedAt: timestamp('established_at', { withTimezone: true }).notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const paymentInstructions = pgTable('payment_instructions', {
  invoiceId: uuid('invoice_id')
    .primaryKey()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  tenantId: tenant(),
  senderEmail: text('sender_email').notNull(),
  replyTo: text('reply_to').notNull(),
  message: text('message').notNull(),
  requestedContact: text('requested_contact').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const humanVerifications = pgTable(
  'human_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    recipient: text('recipient').notNull(),
    instructionHash: text('instruction_hash').notNull(),
    profileRevision: integer('profile_revision').notNull(),
    outcome: text('outcome').notNull(),
    method: text('method').notNull(),
    note: text('note').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('human_verification_invoice').on(t.tenantId, t.invoiceId)],
);
export const servicePaymentIntents = pgTable(
  'service_payment_intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    operationKey: uuid('operation_key').notNull(),
    instructionHash: text('instruction_hash').notNull(),
    analysisInput: jsonb('analysis_input').notNull().default({}),
    challenge: jsonb('challenge').notNull(),
    state: text('state').notNull().default('quoted'),
    payer: text('payer'),
    payloadHash: text('payload_hash'),
    digest: text('digest'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: time(),
  },
  (t) => [
    uniqueIndex('service_operation').on(t.tenantId, t.operationKey),
    uniqueIndex('service_payload_once').on(t.payloadHash),
    uniqueIndex('service_digest_once').on(t.digest),
  ],
);
export const servicePaymentReceipts = pgTable(
  'service_payment_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenant(),
    intentId: uuid('intent_id')
      .notNull()
      .references(() => servicePaymentIntents.id),
    digest: text('digest').notNull(),
    network: text('network').notNull(),
    evidence: jsonb('evidence').notNull(),
    result: jsonb('result').notNull(),
    createdAt: time(),
  },
  (t) => [
    uniqueIndex('service_receipt_intent').on(t.intentId),
    uniqueIndex('service_receipt_digest').on(t.network, t.digest),
  ],
);
