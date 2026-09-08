# Roadmap

## Phase 0 — this MVP (done)

- Signup/login with an embedded, custodial Stellar wallet created automatically
- Provider profiles: category, bio, rate, city, years of experience
- Location-aware search/discovery, sorted by distance or rating
- Job request → accept → escrow-funded → in-progress → complete → confirm &
  release lifecycle, backed by real Stellar payments (or a simulated ledger —
  see ARCHITECTURE.md)
- Ratings & reviews tied to completed jobs
- Dispute raising + admin resolution (release or refund), both real on-chain
  payments
- Seed data: 10 service categories, 8 artisans, 3 customers, 1 admin, sample
  reviews
- End-to-end Playwright smoke test of the full lifecycle

## Phase 1 — production hardening

- [ ] Postgres instead of SQLite (see CONTRIBUTING.md #8)
- [ ] Real geocoding instead of city-centroid coordinates (#3)
- [ ] Provider verification / KYC flow (#5)
- [ ] Notifications — email at minimum, WhatsApp ideally, on every job status
      change (#6)
- [ ] Photo uploads on job requests and completed work (#7)
- [ ] Rate limiting + abuse protection on signup (embedded wallet creation
      currently has no throttle)
- [ ] Structured logging / error monitoring (Sentry or similar) — right now
      failures only go to `console.error`
- [ ] Pagination + real search (not "load every provider and filter in
      memory") (#10)

## Phase 2 — a genuinely trustless escrow

- [ ] Per-job 2-of-3 multisig escrow account (customer + artisan + platform)
      so the platform alone can no longer move funds (#1 in CONTRIBUTING.md —
      the single highest-value contribution to this repo)
- [ ] Soroban smart-contract escrow via [Trustless Work](https://www.trustlesswork.com/)
      (#2) — moves the release rules on-chain entirely
- [ ] On-chain reputation: anchor review hashes (or full reviews) on-chain so
      a provider's rating history is portable and tamper-evident, independent
      of this app's database
- [ ] Non-custodial wallet option for users who want to hold their own keys (#9)

## Phase 3 — real-world money rails

- [ ] SEP-24 anchor integration so users fund/withdraw via Nigerian bank
      transfer, not just XLM they got some other way
- [ ] SEP-38 quotes to replace the fixed demo NGN display rate
      (`lib/currency.ts`) with real, live pricing
- [ ] Settle jobs in a USD- or NGN-pegged asset instead of native XLM, so
      price doesn't move against either party between agreement and completion

## Phase 4 — growth

- [ ] Native mobile app (React Native) — this market is mobile-first
- [ ] Multi-language support: Yoruba, Igbo, Hausa (#11)
- [ ] Expansion beyond Nigeria to other West African markets
- [ ] Provider tooling: a lightweight calendar/availability view, repeat-customer
      management

## Known dependency issue, tracked (not ignored)

`next@14.2.x` bundles a `postcss` version with a known source-map disclosure
advisory (GHSA-r28c-9q8g-f849 and related). There is no patched release inside
the Next.js 14 line — only Next.js 16, a breaking major version bump, resolves
it upstream. It's a dev-tooling-path advisory (source map handling), not a
runtime vulnerability reachable by end users of the deployed app, so it's
tracked here rather than papered over. Revisit when either Next.js backports a
fix to the 14.x line, or as part of a deliberate Next 15/16 upgrade.
