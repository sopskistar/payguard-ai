import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';

// Runs before console/HTML reporters. No private values are exported to the report configuration.
export function redactText(text: string, secrets: string[]): string {
  for (const secret of secrets.filter((value) => value.length >= 8)) {
    for (const variant of new Set([
      secret,
      JSON.stringify(secret).slice(1, -1),
      encodeURIComponent(secret),
    ])) {
      text = text.split(variant).join('[REDACTED]');
    }
  }
  return text;
}
export function redactError(value: unknown, secrets: string[], seen = new WeakSet<object>()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const object = value as Record<string, unknown>;
    if (typeof object[key] === 'string') object[key] = redactText(object[key] as string, secrets);
    else redactError(object[key], secrets, seen);
  }
}
export default class CredentialRedactionReporter implements Reporter {
  private secrets: string[] = [];
  onBegin() {
    let local: Record<string, string> = {};
    try {
      local = parse(readFileSync('.env.local'));
    } catch {
      /* No credential file in public CI. */
    }
    this.secrets = Object.entries({ ...local, ...process.env })
      .filter(
        ([name, value]) =>
          /PASSWORD|SECRET|PRIVATE_KEY|API_KEY|DATABASE_URL/.test(name) &&
          typeof value === 'string',
      )
      .map(([, value]) => value!);
  }
  onError(error: unknown) {
    redactError(error, this.secrets);
  }
  onTestEnd(_test: TestCase, result: TestResult) {
    for (const error of result.errors) redactError(error, this.secrets);
    for (const attachment of result.attachments) {
      // Trace/video/screenshots are disabled. Text attachments are cleaned before HTML embeds them.
      if (!/text|json|javascript/.test(attachment.contentType)) continue;
      if (attachment.body)
        attachment.body = Buffer.from(redactText(attachment.body.toString('utf8'), this.secrets));
      if (attachment.path) {
        try {
          const body = readFileSync(attachment.path, 'utf8');
          writeFileSync(attachment.path, redactText(body, this.secrets));
        } catch {
          /* Missing attachments are reported by Playwright; never print their contents. */
        }
      }
    }
  }
}
