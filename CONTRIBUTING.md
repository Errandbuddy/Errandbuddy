# Contributing to Errandbuddy

Thanks for considering it! This project is meant to be picked up piece by
piece — through [GrantFox](https://grantfox.xyz) bounties/issues or a direct
PR — so the list below is written as concrete, scoped tasks rather than vague
areas.

## Local setup

```bash
npm install
cp .env.example .env
openssl rand -hex 32   # run twice; paste the two values into JWT_SECRET and
                        # WALLET_ENCRYPTION_KEY in .env
npm run db:setup        # migrate + seed
npm run dev
```

If your network blocks `*.stellar.org` (some corporate/CI networks do), set
`STELLAR_MODE=mock` in `.env` — see ARCHITECTURE.md. Otherwise leave it as
`live` so you're working against real Stellar testnet.

Before opening a PR: `npx tsc --noEmit`, `npm run build`, and — if you touched
the booking/escrow flow — `npm run test:e2e` against a built + started server.

## Code layout

- Routes are Server Components in `app/`. Keep data-fetching in the page
  component; extract shared UI into `components/`.
- Mutations are Server Actions in `lib/actions/`, one file per domain (auth,
  provider, jobs). A Server Action either redirects (see the `ok()`/`fail()`
  helpers in `lib/actions/jobs.ts`) or throws — there's no ad hoc JSON error
  shape to keep in sync with a client.
- Never call `@stellar/stellar-sdk` outside `lib/stellar.ts`. If you need a
  new on-chain capability, add a function there so it goes through the
  live/mock adapter automatically.
- Schema changes: edit `db/schema.ts`, then `npm run db:generate` to create a
  migration file, then `npm run db:migrate` to apply it. Commit the generated
  SQL under `drizzle/`.

## Good first issues

Roughly ordered by impact. Each is scoped to be reviewable as a single PR.

1. **Per-job 2-of-3 multisig escrow.** Replace the platform-custodian escrow
   account (`lib/stellar.ts` / `ensurePlatformAccount`) with a dedicated
   Stellar account per job, signers = customer + artisan + platform, weight 1
   each, threshold 2. Release requires the platform to co-sign with whichever
   party agrees, so the platform alone can no longer move funds. This is the
   single biggest trust upgrade available — see ARCHITECTURE.md and start
   from [`contracts/README.md`](./contracts/README.md) (Stage 1).
2. **Integrate Trustless Work for Soroban escrow.** Swap the multisig (or the
   current custodian model) for a real Soroban smart-contract escrow via
   [Trustless Work](https://www.trustlesswork.com/)'s SDK, so the release
   rules live on-chain instead of in this app's server. Planned layout and
   context in [`contracts/README.md`](./contracts/README.md) (Stage 2).
3. **Real geocoding.** `lib/geo.ts` currently maps a handful of Nigerian city
   names to fixed centroids. Replace with a real geocoding provider (or an
   OSM/Nominatim self-hosted instance) so `address` free-text on a job request
   gets accurate coordinates, and so search distance sorting is meaningful
   below city-level granularity.
4. **NGN stablecoin / anchor integration.** Replace the fixed
   `DEMO_XLM_TO_NGN_RATE` display constant (`lib/currency.ts`) with a real
   SEP-38 quote from a licensed Stellar anchor, and let users fund/withdraw
   their wallet via SEP-24 bank transfer instead of only ever holding XLM.
5. **Provider verification / KYC.** `provider_profiles.isVerified` exists but
   nothing sets it beyond the seed script. Add an admin review flow (ID
   upload, trade certification) that flips it.
6. **Notifications.** Nothing currently tells a provider a job request came
   in, or tells a customer their artisan accepted — add email (or WhatsApp,
   which is how this market actually communicates) notifications on the key
   status transitions in `lib/actions/jobs.ts`.
7. **Photo uploads on job requests and completed work.** Let a customer attach
   a photo of the problem, and let a provider attach a "done" photo before
   marking a job complete.
8. **Non-custodial wallet option.** Let a user connect an existing Stellar
   wallet (Freighter) instead of using the embedded custodial one, with
   client-side transaction signing for their own payments.
9. **Pagination + full-text search on `/search`.** Right now it loads every
   provider profile and filters in memory — fine for a seeded demo, not for
   thousands of artisans.
10. **Multi-language support.** Add Yoruba/Igbo/Hausa translations — this
    market is not English-only, especially outside major cities.
11. **Unit tests for `lib/actions/jobs.ts`'s state machine.** The Playwright
    smoke test (`scripts/smoke-test.mjs`) covers the happy path and one
    dispute end-to-end, but the status-transition guards (e.g. "can't fund
    escrow twice", "can't dispute a cancelled job") don't have focused tests.

Have an idea that's not on this list? Open an issue describing the problem
(not just the solution) — a real user pain point beats a speculative feature
every time.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened instead,
and — if it's related to the escrow flow — whether you're running
`STELLAR_MODE=live` or `mock`.
