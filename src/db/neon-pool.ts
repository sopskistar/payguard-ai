import { Pool } from '@neondatabase/serverless';

type ConnectCallback = Parameters<Pool['connect']>[0];
type AcquiredClient = NonNullable<Parameters<ConnectCallback>[1]>;

// Only classify failures before Pool.connect hands a client to any query/transaction.
function transientConnectFailure(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 4) return false;
  const value = error as {
    type?: string;
    code?: string;
    message?: string;
    cause?: unknown;
    error?: unknown;
  };
  return (
    value.type === 'error' ||
    /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|08001|08006|57P01)$/.test(
      value.code || '',
    ) ||
    value.message === 'Connection terminated due to connection timeout' ||
    (!!value.cause && transientConnectFailure(value.cause, depth + 1)) ||
    (!!value.error && transientConnectFailure(value.error, depth + 1))
  );
}

export class RecoveringNeonPool extends Pool {
  connect(): Promise<AcquiredClient>;
  connect(callback: ConnectCallback): void;
  connect(callback?: ConnectCallback): Promise<AcquiredClient> | void {
    const pending = this.acquire();
    if (!callback) return pending;
    void pending.then(
      (client) => callback(undefined, client, (reason) => client.release(reason)),
      (error) => callback(error, undefined, () => {}),
    );
  }

  private async acquire(): Promise<AcquiredClient> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await super.connect();
      } catch (error) {
        if (attempt === 1 || this.ending || !transientConnectFailure(error))
          throw Object.assign(
            new Error('Neon connection could not be established.', { cause: error }),
            { name: 'DatabaseError' },
          );
        // No application SQL has been dispatched. Retry this handshake once only.
        // Never retry query(), BEGIN/COMMIT, a transaction callback or a handler.
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
}
