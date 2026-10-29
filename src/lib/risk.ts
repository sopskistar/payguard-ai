import type { Assessment, Citation, Finding, Invoice, Policy, Preferences } from './types';
import { canonicalCoin, units } from './validation';
const amount = (s: string) => units(s, 18);
export function evaluate(
  invoice: Invoice,
  history: Invoice[],
  prefs: Preferences,
  policies: Policy[] = [],
  citations: Citation[] = [],
  memoryStatus = 'Off',
  now = new Date(),
  instructionFindings: Finding[] = [],
  establishedRecipient?: string,
): Assessment {
  const findings: Finding[] = [...instructionFindings];
  const add = (
    id: string,
    title: string,
    evidence: string,
    severity: Finding['severity'],
    action: string,
    memoryId?: string,
  ) => findings.push({ id, title, evidence, severity, action, memoryId });
  if (
    /\b(?:ignore|override|disregard)\b.{0,100}\b(?:instructions?|rules?|safety)\b|\bmark.{0,30}payment approved\b/i.test(
      invoice.memo,
    )
  )
    add(
      'untrusted-instructions',
      'Invoice contains instructions to bypass review',
      'Imported invoice text is inert data. It cannot authorize tools, change policy or approve payment.',
      'critical',
      'Ignore embedded directives and verify the supplier through the established channel.',
    );
  const peers = history.filter(
    (i) => i.id !== invoice.id && i.isDemo === invoice.isDemo && i.vendorId === invoice.vendorId,
  );
  const confirmed = peers.filter(
    (i) => ['approved', 'paid'].includes(i.status) && i.issued <= invoice.issued,
  );
  const baseline = confirmed.filter((i) => i.currency === invoice.currency);
  const duplicate = peers.find(
    (i) => i.number.toLowerCase().trim() === invoice.number.toLowerCase().trim(),
  );
  if (duplicate)
    add(
      'duplicate-number',
      'Duplicate invoice number',
      `Invoice ${duplicate.number} already exists for this vendor.`,
      'critical',
      'Check whether this is a rebill before approving.',
    );
  const near = peers.find(
    (i) =>
      i.number !== invoice.number &&
      i.currency === invoice.currency &&
      amount(i.amount) === amount(invoice.amount) &&
      i.recipient === invoice.recipient &&
      Math.abs(Date.parse(i.issued) - Date.parse(invoice.issued)) <= 3 * 86400000,
  );
  if (near)
    add(
      'near-duplicate',
      'Possible duplicate billing',
      `Same amount, currency and recipient within three days of ${near.number}. This is a possible match.`,
      'warning',
      'Compare service periods and invoice line items.',
    );
  const knownRecipients = confirmed.map((i) => i.recipient).filter(Boolean);
  const changed =
    instructionFindings.some((f) => f.id === 'trusted-recipient-change') ||
    (!!invoice.recipient &&
      knownRecipients.length > 0 &&
      !knownRecipients.includes(invoice.recipient));
  if (changed)
    add(
      'recipient-change',
      'Recipient address changed',
      `Recipient differs from ${knownRecipients.length} confirmed vendor invoice(s). Address syntax provides no trust evidence.`,
      'warning',
      'Verify payout details through an independent, established channel.',
    );
  if (!peers.length)
    add(
      'new-vendor',
      'First invoice from this vendor',
      'No other invoices exist in this workspace.',
      'info',
      'Confirm the vendor and payment details independently.',
    );
  if (baseline.length >= 2) {
    const avg = baseline.reduce((sum, i) => sum + amount(i.amount), 0n) / BigInt(baseline.length);
    if (amount(invoice.amount) * 100n > avg * 150n)
      add(
        'amount-deviation',
        'Amount exceeds the historical baseline',
        `More than 50% above the average of ${baseline.length} confirmed ${invoice.currency} invoices. Descriptive baseline only.`,
        'warning',
        'Confirm the scope and amount with the vendor.',
      );
  } else
    add(
      'baseline-unknown',
      'Limited payment history',
      `Baseline: ${baseline.length} confirmed invoice(s) in ${invoice.currency}; at least two needed. Confidence is unknown.`,
      'info',
      'Review against the original agreement.',
    );
  if (invoice.currency === prefs.currency && amount(invoice.amount) > amount(prefs.threshold))
    add(
      'threshold',
      'Manual review threshold exceeded',
      `${invoice.amount} ${invoice.currency} exceeds your ${prefs.threshold} ${prefs.currency} threshold.`,
      'warning',
      'Obtain explicit human approval.',
    );
  if (invoice.currency !== prefs.currency)
    add(
      'currency-threshold',
      'Threshold cannot be compared',
      `Your threshold is in ${prefs.currency}; this invoice is in ${invoice.currency}. No exchange rate is assumed.`,
      'info',
      'Review using an agreed currency conversion.',
    );
  const days = Math.ceil(
    (Date.parse(invoice.due) - Date.parse(now.toISOString().slice(0, 10))) / 86400000,
  );
  if (invoice.status === 'open' && days < 0)
    add(
      'overdue',
      'Invoice is overdue',
      `${Math.abs(days)} day(s) past the due date. Urgency does not establish legitimacy.`,
      'warning',
      'Confirm the payment schedule; keep verification checks.',
    );
  else if (invoice.status === 'open' && days <= 3)
    add(
      'due-soon',
      'Payment due soon',
      `Due in ${days} day(s).`,
      'info',
      'Schedule a review before the due date.',
    );
  if (invoice.coinType && !invoice.recipient)
    add(
      'missing-recipient',
      'Recipient is missing',
      'A crypto invoice needs an intended recipient.',
      'warning',
      'Add the recipient before attempting reconciliation.',
    );
  if (
    invoice.coinType &&
    !prefs.allowedTokens.map(canonicalCoin).includes(canonicalCoin(invoice.coinType))
  )
    add(
      'token-not-allowed',
      'Token requires approval',
      'The invoice coin type is not in your allowed-token settings.',
      'warning',
      'Review the token identity and update the allowlist only if intended.',
    );
  if (invoice.coinType && !invoice.tokenAmount)
    add(
      'missing-token-amount',
      'Agreed token amount is missing',
      'Fiat amounts cannot be compared to token units.',
      'warning',
      'Record an explicitly agreed token amount.',
    );
  for (const p of policies.filter(
    (p) =>
      p.active &&
      !p.supersededBy &&
      (!p.expiresAt || Date.parse(p.expiresAt) > now.getTime()) &&
      (p.isDemo === undefined ? p.scope !== 'all' : p.isDemo === invoice.isDemo) &&
      (p.scope === 'all' ||
        (p.scope === 'vendor' && p.vendorId === invoice.vendorId) ||
        (p.scope === 'invoice' && p.invoiceId === invoice.id)),
  )) {
    const citation = citations.find((c) => c.policyId === p.id);
    if (!p.hard && !citation) continue;
    const evidence = `${p.hard ? 'Mandatory user rule' : 'Recalled user correction'}: ${p.text}`;
    if (
      p.kind === 'verify_address' &&
      !!invoice.recipient &&
      (establishedRecipient
        ? invoice.recipient.toLowerCase() !== establishedRecipient.toLowerCase()
        : changed || !knownRecipients.includes(invoice.recipient))
    )
      add(
        `policy-${p.id}`,
        'Independent address verification required',
        evidence,
        'critical',
        'Confirm the new recipient through a trusted channel before approval.',
        citation?.id,
      );
    if (
      p.kind === 'threshold' &&
      p.value &&
      invoice.currency === (p.currency || prefs.currency) &&
      amount(invoice.amount) > amount(p.value)
    )
      add(
        `policy-${p.id}`,
        'Remembered approval threshold',
        evidence,
        'critical',
        'Obtain explicit manual approval.',
        citation?.id,
      );
    if (
      p.kind === 'escalate' &&
      (changed || findings.some((f) => f.id === 'near-duplicate' || f.id === 'duplicate-number'))
    )
      add(
        `policy-${p.id}`,
        'Previously escalated pattern matched',
        evidence,
        'critical',
        'Escalate this repeated pattern to the reviewer.',
        citation?.id,
      );
    if (p.kind === 'duplicate' && (duplicate || near))
      add(
        `policy-${p.id}`,
        'Prior billing incident recalled',
        evidence,
        'critical',
        'Compare line items with the previously corrected billing incident.',
        citation?.id,
      );
    if (p.kind === 'exception')
      add(
        `policy-${p.id}`,
        'Confirmed exception context',
        evidence,
        'info',
        'Check whether the prior exception applies. Mandatory checks still require review.',
        citation?.id,
      );
  }
  const score = Math.min(
    100,
    findings.reduce(
      (n, f) => n + (f.severity === 'critical' ? 40 : f.severity === 'warning' ? 15 : 0),
      0,
    ),
  );
  const level = findings.some((f) => f.severity === 'critical')
    ? 'High risk / verification required'
    : findings.some((f) => f.severity === 'warning')
      ? 'Needs review'
      : baseline.length < 2
        ? 'Insufficient evidence'
        : 'Low';
  return {
    level,
    score,
    findings,
    citations: citations.filter((c) => findings.some((f) => f.memoryId === c.id)),
    memoryStatus,
    baselineSize: baseline.length,
  };
}
