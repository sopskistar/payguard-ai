// Public, read-only evidence. Never loads credentials or invokes a wallet/provider write.
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const origin = 'https://payguard-ai-henna.vercel.app';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
async function read(url: string) {
  const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  if (text.length > 16000000) throw new Error('Public evidence exceeds review size limit');
  return { r, text };
}
const pages = [];
const scripts = new Map<string, { url: string; status: number; sha256: string }>();
for (const path of ['/', '/connect', '/try', '/api/release', '/api/auth/wallet/status']) {
  const { r, text } = await read(origin + path);
  const sources = [...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
    (m) => new URL(m[1], origin),
  );
  for (const source of sources) {
    if (source.origin !== origin) continue; // Record unexpected origin; do not execute/follow it.
    if (!scripts.has(source.href)) {
      const asset = await read(source.href);
      scripts.set(source.href, {
        url: source.href,
        status: asset.r.status,
        sha256: sha256(asset.text),
      });
    }
  }
  pages.push({
    path,
    status: r.status,
    redirect: r.headers.get('location'),
    scriptOrigins: [...new Set(sources.map((s) => s.origin))],
    iframeCount: [...text.matchAll(/<iframe\b/g)].length,
    headers: Object.fromEntries(
      [
        'content-security-policy',
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
        'referrer-policy',
        'permissions-policy',
      ].map((h) => [h, r.headers.get(h)]),
    ),
    ...(path.startsWith('/api/') ? { response: JSON.parse(text) } : {}),
  });
}
const lists = [];
const hostname = new URL(origin).hostname;
for (const path of [
  'src/domain-list.json',
  'blocklists/domain-list.json',
  'allowlists/domain-list.json',
]) {
  const url = 'https://raw.githubusercontent.com/MystenLabs/wallet_blocklist/main/' + path;
  const { r, text } = await read(url);
  if (!r.ok) throw new Error('Official blocklist unavailable');
  const data = JSON.parse(text);
  // Exact hostname/parent membership only; does not reproduce Slush's fuzzy/remote/cache logic.
  const matches = (values: unknown) =>
    Array.isArray(values)
      ? values
          .filter((v) => typeof v === 'string' && (v === hostname || hostname.endsWith('.' + v)))
          .slice(0, 20)
      : [];
  lists.push({
    url,
    status: r.status,
    sha256: sha256(text),
    blockMatches: matches(data.blocklist),
    allowMatches: matches(data.allowlist),
    fuzzyEntries: Array.isArray(data.fuzzylist) ? data.fuzzylist.length : null,
  });
}
const result = {
  checkedAt: new Date().toISOString(),
  origin,
  reportedWarning: 'Malicious website — This site has been flagged for malicious behavior.',
  warningSource: 'Owner report; no physical Slush extension installed in this controlled browser',
  productionOnboarding: 'BLOCKED pending provider review',
  pages,
  scripts: [...scripts.values()],
  lists,
  limits:
    'Read-only public origin/resource and exact-list review, not a malware certification, full dependency audit, fuzzy-list reproduction or proof the warning cleared. No wallet connected, signatures requested, or safety protection disabled.',
};
await writeFile('docs/evidence/slush-security-review.json', JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    pages: pages.map((p) => ({
      path: p.path,
      status: p.status,
      redirect: p.redirect,
      scriptOrigins: p.scriptOrigins,
    })),
    scriptAssets: scripts.size,
    lists,
    warningCleared: false,
  }),
);
