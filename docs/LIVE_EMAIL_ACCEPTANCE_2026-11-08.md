# Live invoice email acceptance — November 8, 2026

**EMAIL FORWARDING: VERIFIED.** Genuine forwarding, private storage, extraction and tenant-isolated Inbox review are verified. This is an actual external email, not a simulated delivery. The owner sent `payguard-live-inbound-synthetic.pdf`, invoice `SYN-EMAIL-20261105-01`, to the administrator workspace's private intake address. Private aliases, sender addresses, signed download URLs and credentials are excluded from this report.

## Verified deployment and storage

Production recognizes all four receiving settings, the `invoices.flownix.xyz` domain and the `read-write-token` storage authentication mode. No credential value was returned by the readiness check. The domain's MX is priority 10 at `receive-euw1.forge.rmta.net`; existing ShadowBid and mailbox records were not modified. Historical payment recovery remains disabled.

A separate disposable synthetic PNG passed an actual private upload, authenticated preview, anonymous denial, independent-workspace document/preview denial, provider deletion acknowledgement and deleted-source denial. These checks establish live private storage access; they do not substitute for processing the emailed PDF. Seven-day access expiry is covered by isolated tests, not a seven-day live observation. Physical scheduled cleanup still requires the documented owner scheduler.

## Genuine delivery and correction

The original Resend message reached Production at **21:57:22 UTC**. The persisted inbound row and its execution path establish successful raw Svix signature verification, exact administrator-workspace routing, and authenticated Resend metadata and attachment-list retrieval. Processing then failed with `ATTACHMENT_HOST`, before downloading or retaining the PDF. A failed delivery is not successful extraction.

The owner requested server-side inspection of the actual attachment host. A temporary, authenticated diagnostic was limited to an already signature-verified `ATTACHMENT_HOST` failure belonging to the current workspace. It rechecked the Resend message ID and owned destination and returned only hostnames, never signed URLs, email content or authorization headers. It could not download, replay, approve or create an invoice. Production returned **401** for anonymous access and **404** for a different authenticated workspace. The correction removes this temporary endpoint.

At **22:12:28 UTC**, the authenticated Resend receiving API returned **`cdn.resend.app`** for the original attachment. An independent TLS request to that host validated its certificate and returned **403 without a redirect** at the unsigned root, which is not a content download. Resend [documents its `resend.app` receiving infrastructure](https://resend.com/blog/inbound-emails); the attachment host itself is established by the authenticated live provider response, not inferred from the documentation's example `inbound-cdn.resend.com` URL.

**Confirmed cause:** PayGuard's allowlist omitted that exact provider CDN. The correction adds only the exact `cdn.resend.app` hostname, not every `resend.app` subdomain. The signature, API metadata/destination checks, HTTPS-only requirement, credentials/port rejection, blocked redirects, timeouts, three-attachment/3 MB limits, content validation and private tenant storage remain in force. No signed URL or credential was logged. Integration fixtures cover both the earlier documented CDN and the observed CDN, including idempotency and no automatic supplier trust; negative cases reject lookalikes, other subdomains, credentials, ports and insecure URLs. These fixtures are not live-delivery proof.

Resend's [received-attachment API](https://resend.com/docs/api-reference/emails/list-received-email-attachments) supplies expiring download URLs; [its processing guide](https://resend.com/docs/dashboard/receiving/attachments) requires refreshing attachment metadata after expiry. Any correction must use the authenticated live response, retain HTTPS-only downloading, blocked redirects, bounded size and content validation, and then process the **same original message** through the signed idempotent webhook.

## Production chronology

All times are UTC on November 8 unless stated otherwise. Application failure timestamps are persisted handler-state observations, not a substitute for every individual Resend delivery-attempt log.

| Time                        | Evidence                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 21:57:20.612                | Original provider event timestamp supplied by the owner                                                                                        |
| 21:57:22.226                | Original administrator-owned inbound row created                                                                                               |
| 22:02:14.964                | Last captured pre-fix `ATTACHMENT_HOST` failure update                                                                                         |
| 22:17:56                    | Exact-host correction source commit created                                                                                                    |
| 22:19:24.744                | Corrected Production SHA `7a5543c1ac7a1bb5547e3df19cc3e9efebbba9cc` first independently verified live; seven healthy routes; recovery disabled |
| 22:37:20.237                | Same original message `completed`, error cleared, one privately retained PDF review draft                                                      |
| November 9, 01:46:38 onward | Actual private preview, tenant denial and desktop/mobile review checks passed; no save or financial request                                    |

The owner later reported a dashboard showing three 422 attempts and a scheduled retry. Independent Resend management access is unavailable, so individual attempt timestamps could not be established. The captured failures above predate the correction; the persisted completion demonstrably follows the verified deployment. No post-fix host failure is inferred from an undated dashboard summary. The corrected release and retained completed message were independently verified. Final release identity is recorded in the closeout completion report and available from `/api/release`.

## Completed live checks

**21 read-only acceptance assertions passed**, including one original completed message, one administrator-owned PDF, exact 18,241-byte fixture hash, private source retention, correct fields, one provider intake audit, no automatic invoice/trust, actual Private Blob preview, private/no-store caching, anonymous denial, authenticated other-workspace document/preview 404s, exclusion from the other Inbox, and responsive desktop/mobile source review with the save button disabled until confirmation. SPF, DKIM and DMARC were provider-reported `pass`; the supplier remains explicitly unverified.

The original document is `db8980ed-0d25-4f21-b03e-d70a9dfbe7dc`, status `review`, with no saved invoice yet. The owner may review and confirm it through the normal administrator UI. Test automation opened the draft but did not check the human-review box or save it.

Completed-message idempotency and failed-message resumption pass isolated integration tests for both provider CDNs. The original failed message was actually resumed without replacing its email/attachment identities, producing one document and one audit. The handler locks the durable message claim and returns immediately for a completed message, before attachment metadata retrieval, downloading or document creation. Isolated integration tests verify one private upload, three initial provider fetches and no further fetches on repeated delivery for both CDN hosts. Production retains exactly one original document and one intake audit. No additional post-success provider redelivery was observed or initiated. Provider-attempt history is supplementary evidence and does not invalidate the completed Production PDF processing.

The PDF fixture's expected SHA-256 is `2bdbe51af9d8a026a3d5f5ebee76d8fbd9ceb864c6c6472cc6ae87452bd325ed`. Expected review fields are the synthetic supplier **Cypress Intake QA Synthetic**, invoice **SYN-EMAIL-20261105-01**, issued **2026-11-05**, due **2026-11-30**, **USD 1,250.00** and the explicitly nonpayable synthetic bank reference. Extracted values remain suggestions requiring source review.

## Original identifiers and acceptance scope

| Identifier                      | Preserved value                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Original provider webhook event | `msg_3LqIC8uP4zAjS8cm7XIpCwErBQF` (owner-supplied event identity)                  |
| Resend email                    | `87cbe9f6-3b95-4304-8db3-dbde5a693310`                                             |
| Original attachment             | `ac48855c-12e2-4a73-8b4a-e71fdcc20a81`                                             |
| Durable message key             | `resend:87cbe9f6-3b95-4304-8db3-dbde5a693310`                                      |
| Attachment key                  | `resend:87cbe9f6-3b95-4304-8db3-dbde5a693310:ac48855c-12e2-4a73-8b4a-e71fdcc20a81` |
| Subject                         | `PayGuard synthetic invoice acceptance — SYN-EMAIL-20261105-01`                    |

The application deduplicates by provider email and attachment IDs. It does not persist Svix attempt IDs as separate delivery-history rows; the original event ID above is preserved as the supplied evidence identity, without claiming a newly observed provider attempt. The durable completed row, exact attachment key/hash, extracted fields and verified-provider intake audit establish the successful original signed processing path. The PDF is one **document review draft**, with `invoice_id = null`; it is not an automatically saved payable invoice.

[Sanitized live acceptance ledger](evidence/live-email-acceptance-20261108.json) · [financial and memory preservation](evidence/email-closeout-preservation-20261108.json) · [final handover](FINAL_HANDOVER.md).

## Financial and memory boundaries

This acceptance makes no payment quote, wallet signature, blockchain submission or Walrus write. Existing payment records, receipts, recovered customer holds, the separate protected administrator hold, Harborline records and all 50 confirmed memory references must remain preserved. Terminal SDK acceptance and physical Nightly browser acceptance remain separate claims. The approved hackathon film remains unchanged.
