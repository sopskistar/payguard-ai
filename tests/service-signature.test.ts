import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('@mysten/sui/verify', () => ({ verifyTransactionSignature: mock.verify }));
import { verifyServiceSignature } from '@/lib/integrations/service-signature';
beforeEach(() => {
  mock.verify.mockReset();
});
it.each(['sui:mainnet', 'sui:testnet'] as const)(
  'supplies the %s Sui client needed for zkLogin, using SDK address matching',
  async (network) => {
    const payer = '0x' + '1'.repeat(64);
    const verifyAddress = vi.fn(() => true);
    mock.verify.mockResolvedValue({ verifyAddress, toSuiAddress: () => '0x' + '2'.repeat(64) });
    await verifyServiceSignature('AA==', 'fixture-signature', payer, network);
    expect(mock.verify).toHaveBeenCalledWith(
      new Uint8Array([0]),
      'fixture-signature',
      expect.objectContaining({ address: payer }),
    );
    expect(mock.verify.mock.calls[0][2].client.network).toBe(network.split(':')[1]);
    expect(verifyAddress).toHaveBeenCalledWith(payer);
  },
);
it('rejects a wrong account and propagates an unavailable signature check', async () => {
  mock.verify.mockResolvedValue({ verifyAddress: () => false });
  await expect(
    verifyServiceSignature('AA==', 'fixture', '0x' + '1'.repeat(64), 'sui:mainnet'),
  ).rejects.toThrow('approved payer');
  mock.verify.mockRejectedValue(new Error('Synthetic proof lookup unavailable'));
  await expect(
    verifyServiceSignature('AA==', 'fixture', '0x' + '1'.repeat(64), 'sui:mainnet'),
  ).rejects.toThrow('unavailable');
});
