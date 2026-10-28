export class AppError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export function unavailable(name: string): never { throw new AppError(503,'NOT_CONFIGURED',`${name}: integration not configured. See Settings → Integrations.`); }
export function safeError(error: unknown): string {
 if (error instanceof AppError) return error.message;
 const name = error instanceof Error ? error.name : '';
 if (/Timeout|Abort/.test(name)) return 'Provider timed out. Accepted memory jobs remain pending; retry their status check.';
 return 'The service could not complete this request. Check configuration or retry. No successful write or payment is assumed.';
}
