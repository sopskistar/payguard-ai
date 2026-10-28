# Contributing

Preserve the original branding and existing migration history. Add migrations; never rewrite an applied migration. Production uses Neon; PGlite is an explicitly labeled local test option.

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. For browser smoke tests, start the app, then `npm run test:e2e`. Live tests need privately configured credentials and are distinct from provider fixtures.

Every sensitive route must verify origin, owner session and tenant ownership. Keep secrets, raw provider errors, private invoice payloads and editor swap files out of commits. Never accept supplier spending keys or add payment execution to the review flow. Keep pending writes pending until the provider confirms completion. Do not weaken generic checks to create an artificial memory comparison.

New rules need explicit evidence, stable identifiers, human next steps, negative-control cases and false-positive limitations. Use public primary sources for documented attack patterns; replays are synthetic. Preserve separation between human verification and onchain receipt evidence.
