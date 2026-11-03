export type ServiceSigningState =
  | 'prepared-unsigned'
  | 'signature-declined'
  | 'signature-failed'
  | 'signature-uncertain'
  | 'signed-unsubmitted'
  | 'submitted'
  | 'settled'
  | 'failed'
  | 'expired';

// Wallet diagnostics describe what the client observed. They never prove settlement,
// authorize cancellation, release a reservation, or allow replacing prepared bytes.
export function serviceSigningState(input: {
  state: string;
  expired: boolean;
  disclosed: boolean;
  submitted: boolean;
  walletPhase?: string;
  walletCode?: string;
}): ServiceSigningState {
  if (input.state === 'settled') return 'settled';
  if (input.state === 'failed') return 'failed';
  if (input.submitted || input.disclosed || input.state === 'settling') return 'submitted';
  if (input.walletPhase === 'service.wallet_signed') return 'signed-unsubmitted';
  if (input.walletPhase === 'service.wallet_error')
    return input.walletCode === '4001' ? 'signature-declined' : 'signature-failed';
  if (input.walletPhase) return 'signature-uncertain';
  return input.expired ? 'expired' : 'prepared-unsigned';
}
