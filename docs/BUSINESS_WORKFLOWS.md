# Business invoice verification

The business expansion adds working intake, supplier history and maker-checker routes to the existing application. It preserves the earlier submitted video, recorded Courtroom evidence, personal wallet authentication and service-payment settlement implementation.

## Invoice upload and review

Invoice Inbox → Add Invoice and Team Verification → Add or upload invoice accept PDF, PNG, JPEG, WebP, UTF-8 TXT and one-row CSV. Content signatures and actual image/PDF parsing are checked; extensions and browser MIME types alone are insufficient. Maximum file size is 3 MB; text PDFs support 15 pages and scanned PDFs 3. Images are bounded to 12 megapixels and normalized before local English OCR. Parsing and OCR have bounded timeouts; ambiguous documents fail with an editable/manual-review path.

PDF text and links are extracted without executing PDF actions. Previews are rendered, normalized image pixels. Email HTML and original PDF viewers are never embedded. Invoice text, links, sender claims and apparent instructions remain untrusted data; the application uses no runtime LLM.

Labeled fields, contacts, payment references and links are shown for source review. Missing values are not guessed; conflicting labeled values are withheld. OCR-derived fields are marked heuristic. Supplier-name matching is a suggestion requiring explicit user selection and never changes the established trust reference. Full Sui addresses, `iban:` references and explicit `bank:` account references are supported for supplier review; chain matching still requires a Sui address and explicit token terms.

Every new upload receives a tenant-scoped SHA-256 fingerprint and private draft. Duplicate bytes and duplicate supplier/invoice numbers are checked before confirmation. Saving requires an explicit source-review confirmation. The existing invoice, deterministic review, supplier reference, human hold and optional analysis workflow are reused.

Raw originals are processed ephemerally by default. The browser receives a sanitized source preview and bounded extracted text; Neon stores bounded metadata, not large raw attachments. With an owner-configured **private** Blob store, originals and pixel previews are retained behind authenticated document routes. Blob locations are never returned as public URLs. Access expires after seven days; explicit deletion removes retained objects and extracted drafts while preserving the saved invoice, hashes and audit. Physical timed deletion requires the cleanup task described below; expiry alone is an access cutoff, not proof of provider deletion. No antivirus scanner is configured or claimed.

## Email forwarding

The Resend integration is implemented through `POST /api/intake/inbound`:

1. Verify the raw body using the current Svix library, including replay-age validation.
2. Match exactly one unpredictable, workspace-bound intake address.
3. Claim the provider email ID with a durable lease and idempotent status.
4. Retrieve email metadata and at most three attachment descriptors from the authenticated Resend API.
5. Require the provider response to match the signed message ID and destination.
6. Download only bounded HTTPS attachments from reviewed provider hosts, without redirects.
7. Process attachments through the same upload review pipeline and private storage adapter.
8. Preserve provider-computed SPF/DKIM/DMARC results separately from untrusted header assertions. A pass never establishes supplier identity; failures and unknown results remain visible.
9. Queue source review, without creating a trusted supplier destination or approving an invoice.

A repeated message reuses its persisted state. Partially completed deliveries retain their original attachment keys; provider retries cannot duplicate invoices or approve them. Unknown or ambiguous workspace destinations are not routed to an arbitrary tenant. From and reply-to addresses never grant authorization.

**Live receiving is disabled until all owner configuration is present:**

| Setting                  | Owner configuration                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`         | Receiving API access for the owner’s Resend account                                        |
| `RESEND_WEBHOOK_SECRET`  | Exact signing secret for this endpoint and `email.received` events                         |
| `INVOICE_INBOUND_DOMAIN` | A verified receiving domain or the owner’s assigned Resend receiving subdomain             |
| `BLOB_READ_WRITE_TOKEN`  | Token linked to a private Vercel Blob store; optional with the complete platform OIDC pair |

A connected Vercel store may instead supply `BLOB_STORE_ID` and the platform-managed `VERCEL_OIDC_TOKEN`. The installed Blob SDK supports this mode, and readiness accepts it only when both are present. Do not manually copy or persist the short-lived OIDC token. The forwarding status reports only the authentication mode, never credential values. Uploads still require `access: 'private'`; an incomplete credential pair leaves live intake disabled. Disposable QA clears all three storage-credential variables.

Production uses the separately configured **`invoices.flownix.xyz`** receiving subdomain and Private Blob store. One genuine external synthetic PDF has completed the signed webhook, owned routing, private retention and extraction flow, with one administrator review draft and no automatic trust. Its authenticated source preview is readable only in the correct workspace. Email forwarding is verified; completed-event idempotency passes isolated integration tests. A further live provider redelivery was not observed or required. [Actual acceptance evidence](LIVE_EMAIL_ACCEPTANCE_2026-11-08.md) · [owner operation and setup](PAYGUARD_EMAIL_OWNER_SETUP.md).

The actual authenticated Resend attachment metadata returned **`cdn.resend.app`**. The downloader permits this exact host in addition to its previous provider hosts; it does not trust other `resend.app` subdomains. Signed download queries are never logged. The temporary owned-message metadata diagnostic used during verification was removed from the corrected release. A failed original message can be redelivered through the same signed provider event after a correction; it retains the original provider email and attachment keys.

Use a dedicated receiving subdomain. Add the exact MX/DNS records supplied by Resend for the selected region; do not replace an existing company mailbox’s MX records blindly. Configure the Production webhook URL, event type and signing secret in the provider dashboard, then redeploy. A business administrator can create the workspace intake address after configuration. Members are never asked to supply API keys.

Resend receiving/retention quotas and Blob storage/egress charges depend on the owner’s plan. Review current provider pricing before enabling a new installation. Local tests exercise signed events, failed-message resumption, both documented and observed CDN hosts, private-storage flags, idempotency, sender warnings and negative cases with controlled provider responses. Those fixtures remain separate from the genuine Production email and private-store evidence.

Serverless PDF packaging follows the [upstream worker/canvas guide](https://github.com/mehmet-kozan/pdf-parse/blob/main/docs/troubleshooting.md). The release validates extraction against an isolated copy of the actual dependency trace, including native canvas, PDF worker and OCR assets.

References: [Resend receiving](https://resend.com/docs/dashboard/receiving/introduction), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests), [received-email authentication metadata](https://resend.com/docs/api-reference/emails/retrieve-received-email), [private Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), [Tesseract.js](https://github.com/naptha/tesseract.js).

## Retention cleanup

`GET /api/intake-cleanup` is a scheduler boundary, disabled without an owner-configured `CRON_SECRET` of at least 32 characters. A configured scheduler must send its matching Bearer authorization. The legitimate administrator may alternatively invoke its same-origin authenticated POST. The task takes no tenant or document IDs, removes at most ten already-expired intake records per run, retains audit/checksum/invoice data, and reports held provider deletions instead of fabricating success.

The subsequent [customer-checkout release](CUSTOMER_CHECKOUT_2026-11-09.md) schedules this endpoint daily at 06:00 UTC through Vercel Cron, with a sensitive Production `CRON_SECRET`. The same-origin authenticated administrator POST remains available. Each run is bounded to ten expired source records; expired access remains denied while failed provider deletions are held for retry.

## Organization and maker-checker authority

Team Verification → Create business workspace requires explicit confirmation that the current workspace’s supplier/invoice/review records will be shared with the members added. No existing workspace becomes shared automatically. Service payments, wallet balances, signing permissions and payer identity remain personal.

A prospective teammate first completes ordinary wallet sign-in. An active organization administrator binds that existing wallet identity to requester, verifier or administrator membership. No invitation email, credentials or session transfer is fabricated. Membership changes and revocation are audited; at least one administrator must remain.

| Role          | Authorized business actions                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Requester     | Upload/review source, create or edit an open invoice, record reported instructions and propose a change |
| Verifier      | Read authorized evidence and record an independent decision on another identity’s proposal              |
| Administrator | Manage memberships and request/review work, with the same no-self-approval rule                         |

Current membership is read from the database on every operation. Mutations lock the workspace identity and organization before invoice/vendor rows, serializing against revocation and competing approvals. The client cannot choose its role, actor identity or tenant. Revoking a member removes authority from its existing session; it does not rewrite historical decisions.

A proposal captures the exact instruction hash, current recipient/reference revision, proposed destination, requester identity and supporting note. A different authorized verifier uses the pre-established independent channel and records outcome, method, evidence reference and note. A confirmed decision updates the reference and current attestation atomically. Rejection and clarification do not establish the proposed destination. Material edits invalidate previous proposals/approvals; verification expires after 30 days.

Legacy reference, human-check and invoice approval paths enforce the business gate once an organization exists. Changing roles cannot make a requester a different identity. An unavailable verifier leaves the request pending; there is no force approval. Supplier approval does not authorize an x402 purchase or a supplier transfer. Distinct authenticated wallets are enforced; organizational administration is responsible for assigning them to genuinely separate people.

## Supplier timeline and memory

Vendor Trust and the selected Team Verification invoice show actual audit and row evidence. Events are ordered by recorded timestamp; equal timestamps do not imply an invented sub-order. Historical actors are shown as unknown when not retained. Database events are not relabeled as Walrus records.

A confirmed memory entry exposes its retained job, blob and namespace only to authorized members. Applicability distinguishes current, inactive, expired and explicitly superseded policies. Retrieval timestamps come from recall records; influence is asserted only where `review.evaluated` records the memory as actually used. The timeline does not silently perform a fresh provider availability check.

An approved change can produce a minimized learning candidate for owner review. This action is explicitly **database-only** and does not create a confirmed memory. Actual Walrus writes require separate content/cost consent through the existing integration. The owner-approved 16-record synthetic batch has completed and was independently verified in [its exact manifest and evidence](BUSINESS_MEMORY_BATCH.md).

## Release and incident boundaries

Migration `0007` creates six tables and constraints; it does not rewrite old migrations or alter financial tables. Apply it before deploying the new application. Keep `SERVICE_EXPIRED_RECOVERY_ENABLED=false`. The three customer recoveries and independent customer allowance are preserved; the separate administrator hold remains reserved and does not consume the public sponsor ledger.

On an intake incident, disable the provider webhook/receiving configuration and preserve message IDs and drafts. Do not delete audits or create replacement financial operations. After organizations exist, do not roll back to code that lacks maker-checker guards: retain those guards and deploy a forward fix or a tested guarded release. Additive tables and business audit history remain intact.
