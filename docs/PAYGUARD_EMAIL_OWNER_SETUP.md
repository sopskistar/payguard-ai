# PayGuard receiving — owner setup

Production currently lacks `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INVOICE_INBOUND_DOMAIN` and `BLOB_READ_WRITE_TOKEN`. No Resend, DNS or Vercel management session is connected to this workspace. Receiving remains disabled; no live delivery test has passed.

The read-only DNS check found Zoho MX records at `flownix.xyz`, no MX at `mail.flownix.xyz`, and no MX at the proposed `invoices.flownix.xyz`. No DNS record was changed. The ShadowBid sender identity and keys have not been reused.

Complete these owner actions together:

1. In the existing Resend account, add/verify **`invoices.flownix.xyz`** as a dedicated receiving domain and enable receiving. Add exactly the DKIM/verification records and receiving MX **shown for this domain in that account**, scoped to `invoices` and its verification names. Preserve all root-domain Zoho records and all ShadowBid records. Resend explicitly says MX targets vary by domain/region; a literal target cannot be determined without the account's domain page. Do not copy example SMTP targets or add an invented fallback.
2. Create a dedicated **PayGuard** server API key with receiving-email/attachment retrieval access. A sending-only ShadowBid key is insufficient. Register an **`email.received`** webhook at **`https://payguard-ai-henna.vercel.app/api/intake/inbound`** and obtain that webhook's own signing secret. Keep key/secret values in the owner dashboards; never paste them in chat or commit them.
3. Create/link a **private** Vercel Blob store to PayGuard. Set the four missing variables for **Production only**, with `INVOICE_INBOUND_DOMAIN=invoices.flownix.xyz`, then redeploy the current release. Keep `SERVICE_EXPIRED_RECOVERY_ENABLED=false`; change no spending settings. Receiving/storage quotas and plan costs must be reviewed in the existing accounts before enabling them.
4. In the genuine owning workspace, enable its generated intake address. Forward one clearly synthetic PDF to that exact workspace alias. Verify Resend's signed webhook delivery, the app's single draft/message, private retained source, extracted fields and sender warnings. Replay the same delivery and confirm no second draft or invoice. Review the extraction before saving; it must not establish a trusted supplier destination automatically.

The existing account and domain support cannot be certified without authorized provider access. No real forwarding, private Blob acceptance or scanner service is claimed. The implementation's signed webhook, idempotency, tenant, sender-warning and extraction boundaries have automated coverage.

[Resend custom-domain instructions](https://resend.com/docs/dashboard/receiving/custom-domains) · [receiving API](https://resend.com/docs/api-reference/emails/retrieve-received-email) · [API-key permissions](https://resend.com/changelog/new-api-key-permissions) · [implementation and retention setup](BUSINESS_WORKFLOWS.md).
