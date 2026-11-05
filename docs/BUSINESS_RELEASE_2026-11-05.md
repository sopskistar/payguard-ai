# Business workflow release — November 5, 2026

**Later owner-authorized checkpoint:** the exact 16-record batch is now completed and verified, bringing both provider and confirmed application counts to 50. The earlier pending customer row is reconciled without another write. The expired unsigned acceptance quote was safely cancelled through its owning customer session. A local terminal runner now waits for two actual owner confirmations; no new financial acceptance is claimed. Current tests are 320 unit/integration passes and 62 browser passes with two deliberate skips. [Current checkpoint](AUTHORIZED_ACCEPTANCE_2026-11-05.md) · [current test evidence](TEST_RESULTS.md). The sections below describe the initial feature release and its earlier approval boundaries.

Invoice intake, supplier history and two-person verification are integrated with the existing application and verified through the deployed APIs. This is a post-submission expansion; the approved video and earlier captured evidence remain unchanged.

## Implemented and exercised

- PDF, PNG, JPEG and WebP upload; deterministic PDF text extraction and bundled local English OCR; rendered source preview, missing/conflicting-field review, editable corrections, supplier suggestions and duplicate protection.
- Private document metadata, content validation, processing quotas, bounded size/pages/timeouts, authenticated access, explicit deletion and a retention-cleanup boundary. Raw originals are ephemeral unless the owner configures private Blob storage.
- Resend forwarding with signed webhooks, workspace-specific routes, durable message/attachment idempotency, sender-authentication warnings and the same extraction review. Live receiving is safely disabled until owner configuration and a real inbound test.
- Supplier Change Timeline in Vendor Trust and Team Verification, with actual actors/timestamps, proposals, decisions, invalidation and separate database/Walrus provenance. Retrieved context and actually applied memory remain distinct.
- Explicit business membership, requester/verifier/administrator roles, current server-side authorization, distinct proposer/checker identities, serialized approvals/revocation, immutable instruction binding, expiry and invalidation after material edits. Supplier approval never authorizes a payment.

The real Production synthetic workflow passes upload, fingerprint and preview checks, duplicate rejection, self-approval refusal, separate-verifier approval, persisted timeline, edit invalidation, revoked-session refusal, cross-tenant source protection and actual image OCR. No real supplier callback is represented by these synthetic attestations. [Production workflow evidence](evidence/business-production-qa-20261105155121149.json).

An initial Production PDF failure created no document or invoice. Its serverless trace omitted native canvas and worker assets. The correction passed extraction and OCR from an isolated copy of the traced dependencies, then passed the deployed workflow. [Packaged dependency proof](evidence/business-intake-packaged-validation.json). Mobile invoice labels also receive a narrow readability correction for long invoice numbers.

## Verification

- 316 unit/integration passes.
- Full optimized-app browser suite: 62 passes, two deliberate live-provider skips, zero failures/flakes.
- Focused business/recovery browser checks pass after the mobile correction.
- TypeScript, optimized build and formatting pass. ESLint has zero errors and one existing warning in unrelated owner video tooling.
- Dependency audit: zero advisories. Configured-secret scans found zero matches in staged source and browser assets.
- Actual rendered GitHub README and published article pass their feature/limitation checks. [Public documentation evidence](evidence/business-public-documentation-20261105160721016.json).

[Full browser run](evidence/business-packaged-full-browser.json) · [local validation ledger](evidence/business-release-local-validation.json) · [setup and security](BUSINESS_WORKFLOWS.md).

## Payment preservation and acceptance

The three customer originals remain `expired-unexecuted`, each with exactly one valid successful recovery audit and a 1,000,000 MIST release. Customer and public sponsor historical reservations are zero. The separate administrator original remains `approved`, without a successful recovery audit, retaining its 1,000,000 MIST liability. Other legitimate liabilities remain intact. No recovery was repeated.

Recovery is disabled in the observed Production runtime. The customer's allowance is independent of the administrator workspace. The prior global UI gate has been narrowed to the customer's own verified holds; backend ownership, payer binding, complete liability checks and all signing/settlement guards are preserved.

Harborline `PG-TEST-1103-01` remains open with no unresolved customer holds and 3,000,000 MIST of available allowance. Read-only Tatum and independent full-node checks establish Mainnet identity and sufficient customer funding; the configured merchant matches the three historical receipts. The service price remains 1,000,000 MIST, with separate sponsorship and zero payer gas under the reviewed terms.

The next action belongs to the actual customer session: open Agent Services for Harborline and request one fresh quote. Its terms, expiry and frozen unsigned preparation must be checked before the owner personally approves Nightly's financial signature. This release creates no quote, preparation, signature or submission. Connection-only MATCH remains owner-confirmed. **Final physical Nightly financial acceptance is incomplete until finalized execution and report delivery are independently verified.**

The original three settled payments/reports, original transaction/provider histories, Harborline records and existing memory rows remain preserved. No database seed/reset, recovery operation, supplier transfer or new Walrus write is part of this release.

## Walrus count and exact approval boundary

The application has 34 memory rows: 33 confirmed and one pending. Current read-only provider evidence verifies the original 33 and the additional older pending job's completed, listed blob with matching decrypted text, namespace and owner: 34 distinct provider-verified blobs. The customer-owned pending row has not been changed through administrator credentials and remains excluded from application policy until legitimate reconciliation.

Seventeen new synthetic scenario contracts are locally tested. The revised write manifest selects only 16, toward 50 provider-verified blobs, because the additional existing blob must not be duplicated or ignored. No new write has occurred. The original 18-case live-recall evaluation passes 18/18 authored contracts; this is not a real-world fraud accuracy claim.

Exact proposed manifest: `d6117ac6e40d2d59125454dfdb2bd29594ebf7ac8271785965e2da5c0eb9bc15`, 16 records / 8,193 bytes. Estimated direct owner cost is 0 SUI / 0 WAL through existing sponsorship, with a hard ceiling of zero paid operations and no renewal/funding fallback. [Exact content, destination and safeguards](BUSINESS_MEMORY_BATCH.md). The earlier 17-record proposal is superseded. New jobs/blobs and later-session recall cannot be claimed before separate owner approval and actual confirmation.

## Owner configuration still required

Live email requires the receiving provider, verified domain/DNS, signing secret and private Blob storage described in [the integration boundary](BUSINESS_WORKFLOWS.md). Physical timed source deletion needs an owner-configured scheduler or the legitimate administrator cleanup action. No antivirus service is configured or claimed. No environment secrets were changed by this release.

On an incident, preserve the audit and uploaded-document fingerprints, disable the affected inbound integration, and use a forward fix. Once business organizations exist, retain maker-checker guards in any rollback candidate; do not deploy old code that permits legacy self-approval. Do not drop additive tables, reverse financial rows or delete audit history.
