import type { Finding, HumanVerification, Invoice, PaymentInstruction, VendorTrust } from './types';
export const BEC_SOURCE =
  'https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise';
const domain = (email: string) => email.toLowerCase().trim().split('@')[1] || '';
export function instructionSignals(
  invoice: Invoice,
  profile?: VendorTrust,
  instruction?: PaymentInstruction,
): Finding[] {
  const findings: Finding[] = [];
  const add = (
    id: string,
    title: string,
    evidence: string,
    severity: Finding['severity'] = 'warning',
  ) =>
    findings.push({
      id,
      title,
      evidence,
      severity,
      action:
        'Pause approval. Use the pre-established contact from the vendor profile, not contact details in this request.',
    });
  if (
    /\b(?:ignore|override|disregard)\b.{0,100}\b(?:instructions?|rules?|safety)\b/i.test(
      invoice.memo,
    )
  )
    add(
      'invoice-directive',
      'Invoice attempts to override review',
      'Embedded invoice directives cannot authorize approval.',
      'critical',
    );
  if (!profile)
    add(
      'trust-unknown',
      'No established vendor trust profile',
      'A prior invoice or valid address alone does not establish who controls the recipient.',
    );
  else {
    if (
      invoice.recipient &&
      invoice.recipient.toLowerCase() !== profile.trustedRecipient.toLowerCase()
    )
      add(
        'trusted-recipient-change',
        'Payment instructions differ from the trusted recipient',
        `Proposed ${invoice.recipient}; established ${profile.trustedRecipient}. Independently verify this change.`,
      );
    if (instruction && Date.parse(profile.establishedAt) >= Date.parse(instruction.receivedAt))
      add(
        'contact-not-preexisting',
        'Contact was established after this request',
        'This contact cannot independently validate a request received before the trust profile existed.',
        'critical',
      );
    if (instruction && domain(instruction.senderEmail) !== profile.emailDomain.toLowerCase())
      add(
        'sender-domain-mismatch',
        'Sender domain differs from the established domain',
        `Received domain ${domain(instruction.senderEmail) || 'missing'}; established ${profile.emailDomain}. Email text is user-supplied, not authenticated headers.`,
      );
  }
  if (instruction) {
    if (
      instruction.replyTo &&
      instruction.replyTo.toLowerCase() !== instruction.senderEmail.toLowerCase()
    )
      add(
        'reply-to-mismatch',
        'Reply-to differs from the sender',
        `Replies would go to ${instruction.replyTo}, not ${instruction.senderEmail}.`,
      );
    if (
      /\b(urgent|immediately|today|within .*hours?|asap|confidential|secret|do not tell)\b/i.test(
        instruction.message,
      )
    )
      add(
        'pressure-language',
        'Urgency or secrecy pressure detected',
        'The instruction contains urgency or secrecy wording. This is a contextual signal, not a fraud determination.',
      );
    if (
      /\b(skip|bypass|ignore|do not call|don.t call|no need to (?:call|verify)|without (?:approval|verification))\b/i.test(
        instruction.message,
      )
    )
      add(
        'verification-bypass',
        'Instruction asks to bypass verification',
        'A request to skip established verification cannot authorize changing payment details.',
        'critical',
      );
    if (instruction.requestedContact)
      add(
        'request-supplied-contact',
        'Request supplies its own verification contact',
        'Do not use contact details supplied by the instruction to establish its legitimacy.',
      );
  }
  return findings;
}
export function verificationIsCurrent(
  invoice: Invoice,
  profile: VendorTrust | undefined,
  verification: HumanVerification | undefined,
  hash: string,
  now = new Date(),
) {
  const checked = Date.parse(verification?.checkedAt || '');
  return !!(
    Number.isFinite(checked) &&
    checked <= now.getTime() + 300000 &&
    now.getTime() - checked < 30 * 86400000 &&
    profile &&
    verification &&
    verification.recipient === invoice.recipient &&
    verification.profileRevision === profile.revision &&
    verification.instructionHash === hash
  );
}
export function approvalGate(
  invoice: Invoice,
  profile: VendorTrust | undefined,
  instruction: PaymentInstruction | undefined,
  verification: HumanVerification | undefined,
  hash: string,
  now = new Date(),
) {
  if ((invoice.coinType || invoice.tokenAmount) && !invoice.recipient)
    return {
      allowed: false,
      reason: 'Record the intended recipient before approving onchain payment instructions.',
    };
  const relevant = !!invoice.recipient || !!instruction;
  if (!relevant) return { allowed: true, reason: 'No supplier payment instructions attached.' };
  if (!profile)
    return {
      allowed: false,
      reason:
        'Establish an independently sourced vendor profile before approving supplier instructions.',
    };
  if (instruction && Date.parse(profile.establishedAt) >= Date.parse(instruction.receivedAt))
    return {
      allowed: false,
      reason:
        'The trusted contact must predate this request. Investigate through an independent channel.',
    };
  if (
    verification?.instructionHash === hash &&
    verification?.profileRevision === profile.revision &&
    verification?.recipient === invoice.recipient &&
    verification?.outcome === 'rejected'
  )
    return { allowed: false, reason: 'The human verifier rejected these payment instructions.' };
  const signals = instructionSignals(invoice, profile, instruction);
  if (
    signals.length &&
    !(
      verificationIsCurrent(invoice, profile, verification, hash, now) &&
      verification?.outcome === 'confirmed'
    )
  )
    return {
      allowed: false,
      reason:
        'Complete out-of-band verification of these exact instructions before approving. Prior attestations do not cover edits.',
    };
  return {
    allowed: true,
    reason: signals.length
      ? 'A human attested to these exact instructions through the established contact.'
      : 'No change detected against the established profile; this is not a guarantee of legitimacy.',
  };
}
