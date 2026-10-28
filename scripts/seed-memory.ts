import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
async function main() {
  const { OWNER_ID } = await import('../src/lib/demo');
  const { prepareSeed, processMemoryJob } = await import('../src/lib/integrations/memory');
  const jobs = (await prepareSeed(OWNER_ID)).sort(
    (a, b) => Number(a.operationKey.split('-').at(-1)) - Number(b.operationKey.split('-').at(-1)),
  );
  let confirmed = 0,
    pending = 0,
    failed = 0;
  for (const [index, job] of jobs.entries()) {
    let result;
    try {
      result = await processMemoryJob(OWNER_ID, job.id);
    } catch (error) {
      let cause: unknown = error;
      const codes = [];
      for (let depth = 0; cause && depth < 4; depth++) {
        const e = cause as { name?: string; code?: string; cause?: unknown };
        codes.push({ name: e.name, code: e.code });
        cause = e.cause;
      }
      console.log(JSON.stringify({ event: index + 1, status: 'unconfirmed', diagnostics: codes }));
      pending++;
      continue;
    }
    if (result.status === 'confirmed') confirmed++;
    else if (result.status === 'failed') failed++;
    else pending++;
    console.log(
      JSON.stringify({
        event: index + 1,
        total: jobs.length,
        status: result.status,
        jobId: result.jobId,
        blobId: result.blobId,
        error: result.error,
      }),
    );
  }
  console.log(
    JSON.stringify({
      confirmed,
      pending,
      failed,
      network: 'Walrus Mainnet',
      events: 'synthetic business policies',
      proof: 'Only provider-completed jobs counted',
    }),
  );
  process.exit(confirmed >= 10 ? 0 : 2);
}
main().catch(async (error) => {
  const { safeError } = await import('../src/lib/errors');
  console.error(safeError(error));
  process.exit(1);
});
