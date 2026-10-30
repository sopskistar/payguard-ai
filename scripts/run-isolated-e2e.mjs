import { readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Some hosted Chromium environments report OS network changes between contexts.
// Isolate each spec in a fresh process, preserving every test and safety gate.
const destination = resolve(process.env.PAYGUARD_ISOLATED_DIR || '.data/isolated-e2e');
mkdirSync(destination, { recursive: true });
const summary = {
  startedAt: new Date().toISOString(),
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  isolation: 'A fresh Playwright/Chromium process per spec; sequential; no automatic spec retry',
  mainnetMemoryWrites: false,
  paymentSettlement: false,
  video: false,
  passed: 0,
  failed: 0,
  skipped: 0,
  flaky: 0,
  specs: [],
};
let failed = false;
const files = readdirSync('tests/e2e')
  .filter((f) => f.endsWith('.spec.ts'))
  .sort();
for (const file of files) {
  const reportPath = join(destination, file + '.json');
  const child = spawnSync(
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      'tests/e2e/' + file,
      '--workers=1',
      '--reporter=./tests/credential-redaction-reporter.ts,list,json',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
        LIVE_MEMORY_REUSE: '1',
        PLAYWRIGHT_NO_COPY_PROMPT: '1',
      },
    },
  );
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const { expected = 0, unexpected = 0, skipped = 0, flaky = 0 } = report.stats;
    summary.passed += expected;
    summary.failed += unexpected;
    summary.skipped += skipped;
    summary.flaky += flaky;
    const tests = [];
    const walk = (suites) => {
      for (const suite of suites || []) {
        for (const spec of suite.specs || [])
          for (const test of spec.tests || [])
            tests.push({
              title: spec.title,
              status: test.status,
              annotations: test.annotations,
              durationMs: test.results.reduce((sum, r) => sum + r.duration, 0),
            });
        walk(suite.suites);
      }
    };
    walk(report.suites);
    summary.specs.push({ file, exitCode: child.status, tests });
  } catch {
    summary.specs.push({
      file,
      exitCode: child.status,
      error: 'Missing or unreadable actual reporter result',
    });
    failed = true;
  }
  if (child.status !== 0) failed = true;
}
summary.finishedAt = new Date().toISOString();
summary.ok =
  !failed && summary.failed === 0 && summary.flaky === 0 && summary.specs.length === files.length;
writeFileSync(join(destination, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(
  JSON.stringify(
    { ...summary, specs: summary.specs.map(({ file, exitCode }) => ({ file, exitCode })) },
    null,
    2,
  ),
);
process.exitCode = summary.ok ? 0 : 1;
