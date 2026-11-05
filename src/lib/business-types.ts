import type { Invoice, VendorTrust } from './types';
export type TimelineEvent = {
  id: string;
  at: string;
  source: string;
  category: 'all' | 'recipient' | 'verification' | 'memory' | 'pending';
  title: string;
  actor: string;
  invoice: string | null;
  status: string;
  evidence: Record<string, unknown>;
};
export type BusinessSummary = { id: string; name: string; role: string };
export type BusinessSnapshot = {
  checkedAt: string;
  organization: { id: string; name: string };
  actorId: string;
  role: string;
  invoices: Invoice[];
  profiles: VendorTrust[];
  members: {
    id: string;
    name: string;
    wallet: string | null;
    role: string;
    revokedAt: string | null;
  }[];
  changes: {
    id: string;
    invoiceId: string;
    vendorId: string;
    proposedBy: string;
    checkedBy: string | null;
    previousRecipient: string;
    proposedRecipient: string;
    note: string;
    state: string;
    expiresAt: string;
    createdAt: string;
    checkedAt: string | null;
    decision: Record<string, unknown> | null;
  }[];
  documents: {
    id: string;
    filename: string;
    status: string;
    source: string;
    createdAt: string;
    expiresAt: string;
    invoiceId: string | null;
  }[];
};
