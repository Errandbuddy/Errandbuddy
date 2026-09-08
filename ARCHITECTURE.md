# Architecture

## Overview

Errandbuddy is a single Next.js 14 application (App Router). There is no
separate backend service or REST API — data mutations go through **Server
Actions** (`lib/actions/*.ts`), and reads happen directly in Server Components
via Drizzle queries. This keeps the MVP's surface area small: one deployable
unit, one database, one place to read the whole request lifecycle for any
given action. The on-chain escrow upgrade (multisig, then a Soroban
contract — see below) is deliberately kept in its own top-level `contracts/`
folder rather than folded into this app, since it will eventually be a
separate deployable artifact with its own build/deploy lifecycle.

```
app/                — routes (Server Components) + a handful of forms
lib/actions/        — Server Actions: the only way data gets mutated
lib/stellar.ts       — all Stellar wiring, behind a live/mock adapter
lib/auth.ts          — session cookie (JWT) + current-user loader
lib/crypto.ts        — AES-256-GCM encryption for custodial secret keys
lib/db.ts            — Drizzle client (Postgres via postgres.js)
db/schema.ts          — the entire data model
scripts/             — migrate, seed, and an end-to-end Playwright smoke test
contracts/           — scaffold for the on-chain escrow upgrade (multisig,
                        then Soroban) — see contracts/README.md; no code yet
```

## Data model

Seven tables (`db/schema.ts`):

- **users** — one row per person, `role` is `CUSTOMER | PROVIDER | ADMIN`
- **wallet_accounts** — 1:1 with users; the custodial Stellar keypair
- **service_categories** — Plumbing, Electrical, AC & Refrigeration, etc.
- **provider_profiles** — 1:1 with a `PROVIDER` user; bio, rate, category
- **jobs** — the booking + escrow lifecycle (see below)
- **reviews** — 1:1 with a job, written on release
- **escrow_events** — an append-only audit trail of every fund movement
- **platform_account** — the platform's own custodial Stellar account (escrow custodian)
- **mock_balances** — only used in `STELLAR_MODE=mock`; see below

## Auth & the embedded wallet

Signup takes an email + password (bcrypt-hashed) and, in the same action,
creates a Stellar keypair for the user. The secret key is encrypted
(AES-256-GCM, `lib/crypto.ts`) with a server-side key (`WALLET_ENCRYPTION_KEY`)
and stored in `wallet_accounts`; the public key is stored in the clear.
Sessions are a JWT in an httpOnly cookie (`lib/auth.ts`) — there's no separate
session table.

**This is a custodial wallet model.** The tradeoff is deliberate: most
customers and artisans in this market have never used a crypto wallet, and
asking them to safeguard a 24-word seed phrase before they can book a plumber
would kill adoption before it started. The cost is that Errandbuddy's server
can, in principle, sign transactions on any user's behalf. Mitigating that
(hardware-backed key custody, or a non-custodial signing flow for users who
want it) is real, valuable, well-scoped work — see ROADMAP.md.

## The job lifecycle & escrow design

`jobs.status` is a state machine:

```
REQUESTED → ACCEPTED → ESCROW_FUNDED → IN_PROGRESS → COMPLETED_BY_PROVIDER → RELEASED
                ↓                           ↓                    ↓
            CANCELLED                   DISPUTED ──────────→ REFUNDED
                                                  └────────→ RELEASED (admin resolves in artisan's favor)
```

Every transition that moves money calls `lib/stellar.ts`'s `sendPayment()` and
records the resulting transaction hash in an `escrow_events` row **before** the
job status is allowed to change — see `lib/actions/jobs.ts`. So the on-chain
trail and the app's state are always consistent: if the payment fails, the
status doesn't change either.

### Why a platform-custodied escrow account, not a smart contract, for v1

The honest MVP answer: speed. A single platform-controlled Stellar account
acts as the escrow custodian — funding a job is a real payment from the
customer's wallet into that account; releasing is a real payment out of it to
the artisan (or back to the customer on refund). This is genuinely on-chain
and auditable (every movement has a real transaction hash you can look up on
Stellar Expert in `STELLAR_MODE=live`), but it is **not trustless**: the
platform technically has the keys to move funds without either party's
signature.

The upgrade path, in order of how much trust it removes — stages 1 and 2 have
a scaffold and planned layout waiting in [`contracts/`](./contracts/README.md):

1. **Per-job 2-of-3 multisig account.** Create a dedicated Stellar account per
   job with the customer, artisan, and platform each as a signer with weight
   1, thresholds set to require 2 signatures for any payment. Release requires
   the platform to co-sign with whichever party agrees — the platform alone
   can no longer move funds. Buildable with classic Stellar operations, no
   Soroban needed. **This is the single highest-value contribution someone
   could make to this repo.**
2. **Soroban smart-contract escrow.** Encode the state machine itself on-chain
   (fund / release / refund / dispute as contract calls), so the rules aren't
   just enforced by this app's server — they're enforced by the ledger.
   [Trustless Work](https://www.trustlesswork.com/) already provides exactly
   this as a reusable Soroban escrow protocol, and is what GrantFox itself is
   built on — integrating it rather than writing a contract from scratch is
   the pragmatic path.
3. **Non-custodial signing** for users who want it, so the platform never
   holds their key at all (see the auth section above).

## The live/mock Stellar adapter

`lib/stellar.ts` exports `createFundedAccount`, `getXlmBalance`, and
`sendPayment` — application code (`lib/actions/jobs.ts`, `lib/actions/auth.ts`)
calls only these three functions and never touches the Stellar SDK directly.
Behind that interface there are two implementations, chosen by
`STELLAR_MODE`:

- **`live`** (the shipped default): real Stellar testnet. New accounts are
  funded via Friendbot; payments are real signed `Operation.payment`
  transactions submitted through Horizon. Every hash is independently
  verifiable on Stellar Expert.
- **`mock`**: a `mock_balances` table (`publicKey → balanceXLM`) stands in for
  the ledger. Same function signatures, same insufficient-funds error
  behavior, same starting balance (10,000 XLM, mirroring Friendbot) — just no
  network calls.

This exists because the sandbox this MVP was first built and tested in blocks
all outbound access to `*.stellar.org` (Horizon and Friendbot both return 403
under its network allowlist). Rather than leave the app untestable there, the
adapter pattern means the exact same code runs in both environments, and
`mock` mode is also genuinely useful for contributors working offline, for CI
runners without external network access, and for automated testing without
burning through Friendbot's rate limits. Switching between them is one
environment variable — see `.env.example`.

## Currency display

Job prices and wallet balances are denominated in XLM. `lib/currency.ts` adds
a fixed, clearly-labeled NGN estimate next to XLM amounts purely so Naira-first
users have a familiar reference point — it is **not** a live FX rate or an
oracle. Production pricing should settle in a USD- or NGN-pegged asset via a
licensed Stellar anchor (SEP-24/SEP-38) — see ROADMAP.md.
