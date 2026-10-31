// Disposable LOCAL PostgreSQL QA only. Never migrates, seeds or resets Neon/existing data.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
const directory = await mkdtemp(join(tmpdir(), 'payguard-release-qa-'));
const output = resolve('.data/final-mainnet-qa');
await mkdir(output, { recursive: true });
const base = 'http://localhost:3005';
const password = randomBytes(32).toString('hex');
const env = {
  ...process.env,
  DATABASE_URL: '',
  LOCAL_DATABASE_PATH: directory,
  APP_URL: base,
  AUTH_SECRET: randomBytes(32).toString('hex'),
  OWNER_PASSWORD: password,
  E2E_OWNER_PASSWORD: password,
  E2E_BASE_URL: base,
  MEMWAL_PRIVATE_KEY: '',
  MEMWAL_ACCOUNT_ID: '',
  TATUM_API_KEY: '',
  SERVICE_PAYMENT_PAYER: '',
  SERVICE_PAYMENT_RECIPIENT: '',
  ENABLE_AGENT_PAYMENTS: 'false',
  SERVICE_PAYMENT_SETTLEMENT_ENABLED: 'false',
  LIVE_MEMORY_TEST: '0',
  LIVE_CHAIN_TEST: '0',
  LIVE_MEMORY_REUSE: '1',
  PLAYWRIGHT_HTML_OUTPUT_DIR: join(output, 'html'),
  PLAYWRIGHT_JSON_OUTPUT_FILE: join(output, 'report.json'),
  PLAYWRIGHT_CHROMIUM_EXECUTABLE:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/home/sopski/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
};
async function run(args, filename) {
  const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (chunk) => {
    log += chunk;
  });
  child.stderr.on('data', (chunk) => {
    log += chunk;
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  for (const value of [password, env.AUTH_SECRET]) log = log.split(value).join('[REDACTED]');
  await writeFile(join(output, filename), log);
  if (code !== 0)
    throw Error(`Local QA stage failed: ${filename}; inspect its private redacted log`);
}
await run(['--conditions=react-server', '--import', 'tsx', 'scripts/migrate.ts'], 'migration.log');
await run(
  ['--conditions=react-server', '--import', 'tsx', 'scripts/seed.ts'],
  'synthetic-seed.log',
);
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3005'],
  { env, stdio: 'ignore' },
);
try {
  const deadline = Date.now() + 30000;
  while (true) {
    try {
      if ((await fetch(base + '/api/release')).ok) break;
    } catch {}
    if (Date.now() > deadline) throw Error('Isolated QA server did not become ready');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  let failure;
  try {
    await run(
      [
        'node_modules/@playwright/test/cli.js',
        'test',
        '--reporter=./tests/credential-redaction-reporter.ts,list,json',
      ],
      'browser.log',
    );
  } catch (error) {
    failure = error;
  }
  const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
  const tests = [];
  function collect(suites) {
    for (const suite of suites || []) {
      for (const spec of suite.specs || [])
        for (const test of spec.tests || [])
          tests.push({ title: spec.title, status: test.status, annotations: test.annotations });
      collect(suite.suites);
    }
  }
  collect(report.suites);
  const summary = {
    checkedAt: new Date().toISOString(),
    baseURL: base,
    storage: 'New disposable local PGlite; not Neon',
    existingDataChanged: false,
    liveCredentials: false,
    financialSubmissions: false,
    memoryWrites: false,
    video: false,
    stats: report.stats,
    tests,
  };
  await writeFile(
    'docs/evidence/final-release-local-tests.json',
    JSON.stringify(summary, null, 2) + '\n',
  );
  console.log(JSON.stringify(summary.stats));
  if (failure) throw failure;
} finally {
  server.kill('SIGTERM');
}
