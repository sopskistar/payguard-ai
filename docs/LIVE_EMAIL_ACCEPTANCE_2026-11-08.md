# Live invoice email acceptance — November 8, 2026

Status: **in progress; original-message redelivery pending**. This is an actual external email, not a simulated delivery. The owner sent `payguard-live-inbound-synthetic.pdf`, invoice `SYN-EMAIL-20261105-01`, to the administrator workspace's private intake address. Private aliases, sender addresses, signed download URLs and credentials are excluded from this report.

## Verified deployment and storage

Production recognizes all four receiving settings, the `invoices.flownix.xyz` domain and the `read-write-token` storage authentication mode. No credential value was returned by the readiness check. The domain's MX is priority 10 at `receive-euw1.forge.rmta.net`; existing ShadowBid and mailbox records were not modified. Historical payment recovery remains disabled.

A separate disposable synthetic PNG passed an actual private upload, authenticated preview, anonymous denial, independent-workspace document/preview denial, provider deletion acknowledgement and deleted-source denial. These checks establish live private storage access; they do not substitute for processing the emailed PDF. Seven-day access expiry is covered by isolated tests, not a seven-day live observation. Physical scheduled cleanup still requires the documented owner scheduler.

## Genuine delivery and correction

The original Resend message reached Production at **21:57:22 UTC**. The persisted inbound row and its execution path establish successful raw Svix signature verification, exact administrator-workspace routing, and authenticated Resend metadata and attachment-list retrieval. Processing then failed with `ATTACHMENT_HOST`, before downloading or retaining the PDF. A failed delivery is not successful extraction.

The owner requested server-side inspection of the actual attachment host. A temporary, authenticated diagnostic was limited to an already signature-verified `ATTACHMENT_HOST` failure belonging to the current workspace. It rechecked the Resend message ID and owned destination and returned only hostnames, never signed URLs, email content or authorization headers. It could not download, replay, approve or create an invoice. Production returned **401** for anonymous access and **404** for a different authenticated workspace. The correction removes this temporary endpoint.

At **22:12:28 UTC**, the authenticated Resend receiving API returned **`cdn.resend.app`** for the original attachment. An independent TLS request to that host validated its certificate and returned **403 without a redirect** at the unsigned root, which is not a content download. Resend [documents its `resend.app` receiving infrastructure](https://resend.com/blog/inbound-emails); the attachment host itself is established by the authenticated live provider response, not inferred from the documentation's example `inbound-cdn.resend.com` URL.

**Confirmed cause:** PayGuard's allowlist omitted that exact provider CDN. The correction adds only the exact `cdn.resend.app` hostname, not every `resend.app` subdomain. The signature, API metadata/destination checks, HTTPS-only requirement, credentials/port rejection, blocked redirects, timeouts, three-attachment/3 MB limits, content validation and private tenant storage remain in force. No signed URL or credential was logged. Integration fixtures cover both the earlier documented CDN and the observed CDN, including idempotency and no automatic supplier trust; negative cases reject lookalikes, other subdomains, credentials, ports and insecure URLs. These fixtures are not live-delivery proof.

Resend's [received-attachment API](https://resend.com/docs/api-reference/emails/list-received-email-attachments) supplies expiring download URLs; [its processing guide](https://resend.com/docs/dashboard/receiving/attachments) requires refreshing attachment metadata after expiry. Any correction must use the authenticated live response, retain HTTPS-only downloading, blocked redirects, bounded size and content validation, and then process the **same original message** through the signed idempotent webhook.

## Acceptance still required

- Deploy and verify the exact-host correction.
- Redeliver the original signed provider event; preserve its original email and attachment keys.
- Verify private source retention, exact source SHA-256, PDF extraction and one administrator-owned review draft.
- Open the authenticated source preview and deny anonymous and other-workspace access.
- Repeat the same completed event and verify no additional document, invoice or intake audit.
- Verify the owner can review and explicitly confirm extraction; no supplier destination is trusted automatically.

The PDF fixture's expected SHA-256 is `2bdbe51af9d8a026a3d5f5ebee76d8fbd9ceb864c6c6472cc6ae87452bd325ed`. Expected review fields are the synthetic supplier **Cypress Intake QA Synthetic**, invoice **SYN-EMAIL-20261105-01**, issued **2026-11-05**, due **2026-11-30**, **USD 1,250.00** and the explicitly nonpayable synthetic bank reference. Extracted values remain suggestions requiring source review.

## Financial and memory boundaries

This acceptance makes no payment quote, wallet signature, blockchain submission or Walrus write. Existing payment records, receipts, recovered customer holds, the separate protected administrator hold, Harborline records and all 50 confirmed memory references must remain preserved. Terminal SDK acceptance and physical Nightly browser acceptance remain separate claims. The approved hackathon film remains unchanged.
