PayGuard Verify
Verify before you pay. Remember what nearly went wrong.
PayGuard Verify is the focused payment-instruction verification product built under the PayGuard AI brand for the Total Recall — Tatum × Walrus Memory hackathon, Smart Agents for Real Life track.
Most invoice tools remember what was paid. PayGuard remembers why a payment instruction was questioned, independently verified, or rejected—and applies that learning when the next invoice arrives.
The problem
Business Email Compromise and supplier impersonation can involve convincing invoices with changed payment instructions. The FBI and IC3 recommend checking payment-detail changes through a separate, independently trusted channel rather than trusting contact information in the suspicious request.
PayGuard is a review and decision-support tool, not a guarantee against fraud or a replacement for human identity verification. Its attack demonstrations are synthetic scenarios inspired by documented fraud patterns, not reproductions of specific victims' transactions.
What we're building
Instruction Diff: Flag changes in a supplier's recipient address, unusual amounts, duplicates, and urgent payment requests with understandable evidence.
Vendor Trust Profiles: Track human-verified payment destinations, verification methods, and changes over time.
Human Verification Workflow: Require an independent-channel confirmation when payment instructions change; maintain the audit trail.
Walrus Memory Learning: Store minimally sensitive policy corrections on Walrus Memory Mainnet, recall them across sessions, and visibly show what changed in recommendations.
Attack Replay Lab: Compare initial review, corrected behavior, and memory-on/memory-off results with clearly labeled fictional invoice data.
Tatum Sui gRPC Evidence: Read actual Sui Mainnet balances or transaction details through Tatum to establish whether a payment occurred—not whether the address belongs to the real supplier.
Secure review: No automatic supplier transfers, no wallet seed phrases, no unverified claims of fraud prevention.
Architecture
Next.js / TypeScript / Tailwind / Motion · Neon PostgreSQL / Drizzle ORM · Walrus Memory (`@mysten-incubation/memwal`) · Tatum Sui Mainnet gRPC · Vercel.
Project status
🚧 Under active development. The initial application code was generated, and the current phase is refocusing the workflow on verified supplier-instruction changes, migrating the Tatum adapter to modern Sui gRPC, fixing outstanding checks, and proving live integrations. Features and results are not considered verified until shown in tests and the live deployment.
This repo's `PAYGUARD_AI_CODEX_MASTER_PROMPT.md` is the authoritative continuation specification for Codex. The repository name and existing PayGuard AI logo are intentionally retained.
Run locally
Once dependencies and configuration are available:
```bash
npm install
cp .env.example .env.local
# Privately fill in .env.local; never commit it.
npm run dev
```
Other build, migration, testing and deployment instructions will be verified and expanded by Codex as the implementation is completed. Production credentials must be server-side only. See `docs/INTEGRATION_GUIDE.md` when generated.
Hackathon
Track: Smart Agents for Real Life
Deadline: November 10, 2026 at 17:00 UTC
Submission: Public repository, working demo, blog post, short video, at least 10 confirmed Walrus Mainnet memories and meaningful Tatum onchain integration
Evidence: `docs/MAINNET_PROOF.md` will contain real, verified links/IDs once available; none will be fabricated
References
FBI: Business Email Compromise
IC3: Business Email Compromise
Walrus Memory SDK
Tatum Sui gRPC
Sui gRPC TypeScript SDK
License
MIT — see LICENSE.
