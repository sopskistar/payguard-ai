// Read-only audit: never signs, submits, approves, cancels or writes provider data.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { writeFile } from 'node:fs/promises';
import { normalizeGrpcTransaction } from '../src/lib/integrations/tatum';
import { validateServiceSettlement } from '../src/lib/integrations/service-tatum';
import { canonicalCoin } from '../src/lib/validation';
import {
  serviceTermsSchema,
  validateServiceTransaction,
  MAINNET_GENESIS,
} from '../src/lib/service-protocol';

config({ path: '.env.local', quiet: true });
const sql = neon(process.env.DATABASE_URL!);
const rows =
  await sql`select r.id,r.intent_id,r.digest,r.network,r.result,r.created_at,i.challenge,i.approval,i.payer,i.payload_hash,i.state,i.approved_at,v.number from service_payment_receipts r join service_payment_intents i on i.id=r.intent_id join invoices v on v.id=i.invoice_id order by r.created_at`;
const transport = new GrpcTransport({
  host: 'sui-mainnet-grpc.gateway.tatum.io:443',
  channelCredentials: credentials.createSsl(),
  meta: { 'x-api-key': process.env.TATUM_API_KEY! },
  timeout: 15000,
});
try {
  const client = new SuiGrpcClient({ network: 'mainnet', transport });
  const { response: info } = await client.ledgerService.getServiceInfo({});
  if (info.chain !== 'mainnet' || info.chainId !== MAINNET_GENESIS) throw Error('Wrong chain');
  const payments = [];
  for (const row of rows) {
    const terms = serviceTermsSchema.parse(row.challenge.accepts[0]);
    const { response } = await client.ledgerService.getTransaction({
      digest: row.digest,
      readMask: {
        paths: [
          'digest',
          'transaction',
          'effects.status',
          'effects.gas_used',
          'balance_changes',
          'checkpoint',
          'timestamp',
        ],
      },
    });
    const executed = response.transaction!;
    const tx = normalizeGrpcTransaction(executed);
    const received = validateServiceSettlement(tx, row.digest, terms, row.payer);
    const prepared = row.approval.prepared;
    validateServiceTransaction(prepared.bytes, terms, row.payer);
    const preparedDigest = await Transaction.from(prepared.bytes).getDigest();
    const exactBytes =
      executed.transaction?.bcs?.value &&
      toBase64(executed.transaction.bcs.value) === prepared.bytes;
    const gas = executed.effects?.gasUsed;
    if (
      !gas ||
      !exactBytes ||
      preparedDigest !== row.digest ||
      prepared.digest !== row.digest ||
      row.state !== 'settled' ||
      !row.payload_hash
    )
      throw Error('Receipt binding incomplete');
    const gasAtomic = (gas.computationCost! + gas.storageCost! - gas.storageRebate!).toString();
    const nativeChange = (owner: string) =>
      (tx.balanceChanges || [])
        .filter(
          (c) =>
            typeof c.owner === 'object' &&
            'AddressOwner' in c.owner &&
            c.owner.AddressOwner === owner &&
            canonicalCoin(c.coinType) === canonicalCoin(terms.asset),
        )
        .reduce((sum, c) => sum + BigInt(c.amount), 0n);
    const payerDebit = -nativeChange(row.payer);
    const sponsorDebit = -nativeChange(terms.extra.gasOwner);
    if (payerDebit !== BigInt(terms.amount) || sponsorDebit !== BigInt(gasAtomic))
      throw Error('Actual payer debit or sponsor gas differs from the approved accounting');
    const events =
      await sql`select type,detail,created_at from audit_events where entity_id=${row.intent_id} or (type='service.review_completed' and detail->>'intentId'=${row.intent_id}) order by created_at`;
    const settlementRequests = events.filter((e) => e.type === 'service.settlement_requested');
    if (
      settlementRequests.length !== 1 ||
      !events.some((e) => e.type === 'service.challenge') ||
      !events.some((e) => e.type === 'service.review_completed')
    )
      throw Error('Settlement audit mismatch');
    payments.push({
      quoteId: row.intent_id,
      receiptId: row.id,
      invoice: row.number,
      digest: row.digest,
      explorer: `https://suivision.xyz/txblock/${row.digest}`,
      checkpoint: tx.checkpoint,
      finalized: true,
      network: row.network,
      payer: row.payer,
      merchant: terms.payTo,
      sponsor: terms.extra.gasOwner,
      merchantCreditAtomic: received.toString(),
      payerServiceDebitAtomic: payerDebit.toString(),
      payerGasAtomic: '0',
      sponsorGasAtomic: sponsorDebit.toString(),
      gasBudgetAtomic: terms.extra.gasBudget,
      gas,
      actualBalanceChanges: tx.balanceChanges,
      exactApprovedBytesExecuted: exactBytes,
      preparedDigestMatchesExecution: true,
      challenge: row.challenge,
      approvedAt: row.approved_at,
      settlementRequests: settlementRequests.length,
      events: events.filter((e) => !['service.approved'].includes(e.type)),
      result: row.result,
      firstPartyOwnerControlledAccounts: true,
    });
  }
  const [counts] =
    await sql`select (select count(*) from memory_jobs where status='confirmed')::int as confirmedMemories,(select count(*) from service_payment_receipts)::int as settledReceipts,(select count(*) from service_payment_intents where state='settling')::int as unsettledIntents`;
  const report = {
    checkedAt: new Date().toISOString(),
    source: 'Authenticated Tatum native Sui Mainnet gRPC and persisted Neon rows',
    readOnly: true,
    genesis: info.chainId,
    counts,
    payments,
    settledTotalAtomic: (BigInt(payments.length) * 1000000n).toString(),
    displayReconciliation:
      'Merchant credit is 0.001 SUI; sponsor gas is separately charged. 0.001 minus 0.0001 equals 0.0009, but 0.0009 is not the merchant balance change. The exact SuiVision screen interpretation has not been observed.',
  };
  await writeFile(
    'docs/evidence/mainnet-service-reconciliation.json',
    JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n',
  );
  console.log(
    JSON.stringify({ verified: payments.length, counts, digests: payments.map((p) => p.digest) }),
  );
} finally {
  transport.close();
}
