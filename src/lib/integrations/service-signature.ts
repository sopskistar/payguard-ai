import 'server-only';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { verifyTransactionSignature } from '@mysten/sui/verify';
import { fromBase64 } from '@mysten/sui/utils';
import { serviceNetworkInfo, type ServiceNetwork } from '../service-protocol';

// zkLogin verification can disclose the signed bytes to this read-only RPC.
// Call only AFTER the intent/digest and spending reservation are durably locked.
export async function verifyServiceSignature(
  transaction: string,
  signature: string,
  payer: string,
  network: ServiceNetwork,
) {
  const chain = serviceNetworkInfo(network);
  const client = new SuiGrpcClient({ network: chain.sdk, baseUrl: chain.grpc });
  const key = await verifyTransactionSignature(fromBase64(transaction), signature, {
    address: payer,
    client,
  });
  // SDK address verification also supports the documented zkLogin legacy form.
  if (!key.verifyAddress(payer)) throw new Error('Signature does not match the approved payer');
}
