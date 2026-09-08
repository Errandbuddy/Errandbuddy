# Errandbuddy

**Find a trusted local artisan. Pay only when the job's done.**

Errandbuddy is an open-source MVP marketplace for local handy services (plumbers,
electricians, cleaners, generator technicians, and more) — built for Nigeria and
West Africa first. Think "Upwork for handy jobs": customers search for artisans
near them, see real ratings and reviews from past jobs, and book with confidence
because every payment sits in a **Stellar-secured escrow** until the customer
confirms the work is done.

This project is being built toward a submission to [GrantFox](https://grantfox.xyz)
and the Stellar Community Fund — see [GRANT_PITCH.md](./GRANT_PITCH.md). It's
deliberately structured as an approachable, well-documented MVP with a clear
backlog of good-first-issues (see [CONTRIBUTING.md](./CONTRIBUTING.md)), so
outside contributors can pick up bounties and help take it from MVP to product.

## Why this matters

Finding a reliable artisan in Lagos, Abuja or Port Harcourt today mostly happens
through WhatsApp groups, word of mouth, or hoping the person who shows up
matches who you talked to on the phone. There's no shared reputation layer, and
payment is either cash-on-completion (no protection if the job's bad) or
pay-up-front (no protection if the artisan never shows). Errandbuddy fixes the
trust problem with two ingredients: **public, portable ratings** and **escrow
payments that settle on a real, auditable ledger** rather than a black box only
the platform can see.

## How the escrow works

1. A customer requests a job from an artisan's public profile and agrees a price.
2. The moment the artisan accepts, the customer funds escrow — a real Stellar
   transaction moves the payment out of their wallet and into the platform's
   escrow account. It does **not** go to the artisan yet.
3. The artisan does the work. Either side can raise a dispute at any point.
4. The customer confirms the job is done, which triggers a real on-chain payment
   releasing the escrow to the artisan, and prompts a rating + review.
5. If something goes wrong, either party raises a dispute and an admin resolves
   it — releasing to the artisan or refunding the customer, again as a real
   on-chain payment.

Every one of those movements is logged with its Stellar transaction hash, so
the whole payment trail is independently verifiable — see
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full design, including the honest
tradeoffs of the current platform-custodied escrow model and the upgrade path
to a per-job multisig or Soroban smart-contract escrow (e.g. via
[Trustless Work](https://www.trustlesswork.com/), which GrantFox itself is
built on).

## Tech stack

- **Next.js 14** (App Router, TypeScript, Server Actions — no separate REST API layer)
- **Tailwind CSS**
- **Drizzle ORM + Postgres** for the database (works with any Postgres — Neon,
  Supabase, or Vercel's Postgres storage all have free tiers)
- **@stellar/stellar-sdk** for all on-chain activity, behind a small adapter
  (`lib/stellar.ts`) that supports both real Stellar testnet and an offline
  simulated ledger (`STELLAR_MODE=mock`) — see [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Playwright** for an end-to-end smoke test of the full job/escrow/dispute lifecycle

## Getting started

```bash
npm install
cp .env.example .env
# set DATABASE_URL to any Postgres connection string (a free one from
# neon.tech works, or point it at a local Postgres for development)
# generate real secrets for JWT_SECRET and WALLET_ENCRYPTION_KEY:
#   openssl rand -hex 32   (run twice, paste into .env)

npm run db:setup     # generates + applies migrations, then seeds demo data
npm run dev          # http://localhost:3000
```

By default (`STELLAR_MODE=live` in `.env.example`), this talks to real Stellar
testnet via Horizon + Friendbot — every payment is a genuine, independently
verifiable Stellar transaction. If you're developing somewhere that blocks
outbound access to `*.stellar.org` (as the sandbox this MVP was first built in
does), set `STELLAR_MODE=mock` in your `.env` to use a DB-backed simulated
ledger with the identical interface and behavior — no application code differs
between the two modes.

### Demo accounts

The seed script (`npm run db:seed`) creates these accounts, all with password
`demo1234`:

| Role     | Email                              |
|----------|-------------------------------------|
| Admin    | admin@demo.errandbuddy              |
| Customer | wale.customer@demo.errandbuddy      |
| Artisan  | chuka.plumber@demo.errandbuddy      |

Plus 7 more artisans across plumbing, electrical, AC repair, generator repair,
carpentry, painting, cleaning, and CCTV/networking, each with a Stellar wallet
and a few seeded reviews so the search page isn't empty on first run.

### Running the smoke test

```bash
npm run build && npm run start &
npm run test:e2e
```

Drives a real (headless) browser through signup, search, booking, escrow
funding, job completion, payment release, and the full dispute/admin-resolution
path — 16 checks, all against a production build.

## Project docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — data model, auth, the Stellar escrow
  design and its tradeoffs, the live/mock ledger adapter
- [CONTRIBUTING.md](./CONTRIBUTING.md) — local setup, code layout, and a
  concrete backlog of good-first-issues for GrantFox contributors
- [ROADMAP.md](./ROADMAP.md) — from this MVP to a production-grade, trustless
  marketplace
- [GRANT_PITCH.md](./GRANT_PITCH.md) — the Stellar Community Fund / GrantFox
  pitch summary
- [contracts/README.md](./contracts/README.md) — the on-chain escrow upgrade
  path (multisig, then Soroban): scaffolded, not yet built

## Known limitations of this MVP

- **Custodial wallets.** The platform holds every user's Stellar secret key
  (encrypted at rest) so non-crypto-native users never see a seed phrase. This
  is a deliberate MVP tradeoff — see ARCHITECTURE.md for the non-custodial
  upgrade path.
- **Platform-custodied escrow**, not yet a multisig or smart contract — the
  platform can technically move funds unilaterally today. Flagged as the
  highest-priority contribution; the planned upgrade path and scaffold live
  in [`contracts/`](./contracts/README.md).
- **XLM pricing with an illustrative NGN estimate**, not a real FX oracle or
  stablecoin settlement yet.
- One dev-dependency advisory (a PostCSS source-map disclosure bundled inside
  Next.js 14's own tooling) has no fix available without a Next.js major
  version bump; tracked in ROADMAP.md rather than silently ignored.

## License

MIT — see [LICENSE](./LICENSE).
