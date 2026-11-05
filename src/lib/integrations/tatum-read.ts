import 'server-only';
import { failedPaymentCheck } from '../service-setup';

// Shared by read-only preflight and recovery within one process. Other instances
// can share the key, so permit one cooled-down quota retry, never an error bypass.
let readQueue: Promise<unknown> = Promise.resolve();
let nextReadAt = 0;
export async function pacedTatumRead<T>(operation: () => Promise<T>): Promise<T> {
  const turn = readQueue.then(async () => {
    const delay = Math.max(0, nextReadAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    nextReadAt = Date.now() + 500;
    try {
      return await operation();
    } catch (error) {
      if (failedPaymentCheck('', '', error).classification !== 'rate_limit') throw error;
      await new Promise((resolve) => setTimeout(resolve, 1100));
      nextReadAt = Date.now() + 500;
      return operation();
    }
  });
  readQueue = turn.then(
    () => undefined,
    () => undefined,
  );
  return turn;
}
