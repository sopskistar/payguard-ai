// Entire financial workflow is intercepted in this test. No real signing/submit API is called.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const preview = JSON.parse(await readFile('.data/sui-self-deposit/preview.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
const report = {
  checkedAt: new Date().toISOString(),
  browser: browser.version(),
  mode: 'fully-mocked-signing-and-submission',
  realSignatures: false,
  realSubmissions: false,
  cases: [],
};
try {
  for (const scenario of ['success', 'cancel', 'changed-bytes', 'uncertain', 'expired']) {
    const page = await browser.newPage();
    let state = null;
    const calls = { claim: 0, stored: 0, submit: 0, reconcile: 0 };
    const now = Date.now();
    const prepared = {
      ...preview,
      checkedAt: new Date(now - 1000).toISOString(),
      reviewExpiresAt: new Date(now + (scenario === 'expired' ? -1 : 900000)).toISOString(),
      mode: 'owner-approved-local',
      signingEnabled: true,
      executionEnabled: true,
    };
    await page.route('**/preview.json', (route) =>
      route.fulfill({
        json: {
          ...prepared,
          runtime: { csrf: 'fixture', authorized: scenario !== 'expired', state },
        },
      }),
    );
    await page.route('**/state', (route) =>
      route.fulfill({ json: { state, authorized: scenario !== 'expired' } }),
    );
    for (const path of ['claim-signing', 'signed', 'submit', 'stop', 'reconcile'])
      await page.route('**/' + path, async (route) => {
        const input = route.request().postDataJSON();
        if (path === 'claim-signing') {
          calls.claim++;
          if (state) throw Error('Fixture duplicate claim');
          state = { phase: 'awaiting_wallet', digest: preview.unsignedDigest };
        }
        if (path === 'signed') {
          calls.stored++;
          if (input.bytes !== preview.unsignedBytes || input.signature !== 'fixture-signature')
            throw Error('Unexpected fixture signed data');
          state = { ...state, phase: 'signed' };
        }
        if (path === 'stop') state = { ...state, phase: 'stopped' };
        if (path === 'submit') {
          calls.submit++;
          if (state.phase !== 'signed' || calls.submit !== 1)
            throw Error('Duplicate fixture execution');
          state = { ...state, phase: scenario === 'uncertain' ? 'uncertain' : 'submitted' };
        }
        if (path === 'reconcile') {
          calls.reconcile++;
          state = {
            ...state,
            ...(scenario === 'uncertain'
              ? { verification: { status: 'pending', fixture: true } }
              : { phase: 'confirmed', verification: { status: 'confirmed', fixture: true } }),
          };
        }
        await route.fulfill({ json: { state } });
      });
    await page.addInitScript(
      ({ address, bytes, scenario }) => {
        window.__calls = { connect: 0, sign: 0, execute: 0, exactRequest: false };
        const account = {
          address,
          publicKey: new Uint8Array(32),
          chains: ['sui:mainnet'],
          features: ['sui:signTransaction', 'sui:signAndExecuteTransaction'],
        };
        const wallet = {
          version: '1.0.0',
          name: 'Slush',
          id: 'com.mystenlabs.suiwallet',
          icon: 'data:image/png;base64,AA==',
          chains: ['sui:mainnet'],
          accounts: [account],
          features: {
            'standard:connect': {
              version: '1.0.0',
              connect: async () => {
                window.__calls.connect++;
                return { accounts: [account] };
              },
            },
            'standard:events': { version: '1.0.0', on: () => () => {} },
            'sui:signTransaction': {
              version: '2.0.0',
              signTransaction: async (input) => {
                window.__calls.sign++;
                const tx = JSON.parse(await input.transaction.toJSON());
                window.__calls.exactRequest =
                  input.chain === 'sui:mainnet' &&
                  input.account.address === address &&
                  tx.sender === address &&
                  tx.gasData.owner === address &&
                  tx.gasData.budget === '2000000' &&
                  tx.commands.length === 2;
                if (scenario === 'cancel') throw Error('fixture declined');
                return {
                  bytes: scenario === 'changed-bytes' ? 'changed' : bytes,
                  signature: 'fixture-signature',
                };
              },
            },
            'sui:signAndExecuteTransaction': {
              version: '2.0.0',
              signAndExecuteTransaction: async () => {
                window.__calls.execute++;
                throw Error('Forbidden fallback');
              },
            },
          },
        };
        window.addEventListener('wallet-standard:app-ready', (e) => e.detail.register(wallet));
        window.dispatchEvent(
          new CustomEvent('wallet-standard:register-wallet', {
            detail: ({ register }) => register(wallet),
          }),
        );
      },
      { address: preview.plan.payer, bytes: preview.unsignedBytes, scenario },
    );
    await page.goto('http://localhost:4318');
    await page.waitForFunction(() => !document.querySelector('#discover').disabled);
    await page.locator('#discover').click();
    await page.getByRole('button', { name: /Connect existing Slush account/ }).click();
    if (scenario === 'expired') {
      if (
        !(await page.locator('#unlock').isDisabled()) ||
        !(await page.locator('#sign').isDisabled()) ||
        !(await page.locator('#submit').isDisabled())
      )
        throw Error('Expired controls enabled');
    } else {
      await page.locator('#unlock').click();
      await page.waitForFunction(() => !document.querySelector('#sign').disabled);
      await page.locator('#sign').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#execution').textContent.includes('signed') ||
          document.querySelector('#execution').textContent.includes('stopped'),
      );
      if (calls.submit !== 0) throw Error('Automatic submission after signature');
      if (['success', 'uncertain'].includes(scenario)) {
        await page.locator('#submit').click();
        await page.waitForFunction(() =>
          document.querySelector('#receipt').textContent.includes('fixture'),
        );
        if (
          !(await page.locator('#submit').isDisabled()) ||
          !(await page.locator('#sign').isDisabled())
        )
          throw Error('Retry enabled');
        if (scenario === 'uncertain') {
          await page.locator('#reconcile').click();
          if (calls.submit !== 1) throw Error('Reconcile resubmitted');
        }
      } else if (!(await page.locator('#submit').isDisabled()) || calls.submit)
        throw Error('Cancelled/changed conversion submitted');
    }
    const wallet = await page.evaluate(() => window.__calls);
    if (
      wallet.execute !== 0 ||
      wallet.sign > (scenario === 'expired' ? 0 : 1) ||
      calls.submit > 1 ||
      (scenario !== 'expired' && !wallet.exactRequest)
    )
      throw Error('Fixture wallet invariant failed');
    report.cases.push({ scenario, serverCalls: calls, walletCalls: wallet, passed: true });
    await page.close();
  }
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.message;
} finally {
  await browser.close();
}
await writeFile(
  'docs/evidence/self-deposit-signing-fixtures.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
