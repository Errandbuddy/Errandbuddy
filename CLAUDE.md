# CLAUDE.md

Persistent project context for Claude Code. Read this first; it's the map to
everything else.

## What this is

Errandbuddy — an open-source MVP marketplace for local handy services
(plumbers, electricians, cleaners, generator techs, etc.), "Upwork for handy
jobs," targeting Nigeria/West Africa first. Every job's payment sits in a
Stellar-secured escrow until the customer confirms the work is done. Built
toward a submission to [GrantFox](https://grantfox.xyz) / the Stellar
Community Fund — see `GRANT_PITCH.md`. It's deliberately structured to be
contribution-ready: a documented architecture, a scoped good-first-issues
backlog (`CONTRIBUTING.md`), and honest tradeoffs called out rather than
hidden.

Full docs, in the order a new contributor should read them:
`README.md` → `ARCHITECTURE.md` → `CONTRIBUTING.md` → `ROADMAP.md` →
`GRANT_PITCH.md` → `contracts/README.md`.

## Repo structure

```
app/                 — routes (Next.js App Router, Server Components) + forms
lib/actions/         — Server Actions: the ONLY way data gets mutated
lib/stellar.ts       — all Stellar wiring, behind a live/mock adapter
lib/auth.ts          — session cookie (JWT) + current-user loader
lib/crypto.ts        — AES-256-GCM encryption for custodial secret keys
lib/db.ts            — Drizzle client (better-sqlite3)
lib/geo.ts           — Nigerian city centroids + haversine distance
lib/currency.ts      — XLM → illustrative NGN display estimate
db/schema.ts         — the entire data model (Drizzle schema)
drizzle/             — generated SQL migrations + snapshots (commit these)
scripts/             — migrate, seed, and a Playwright end-to-end smoke test
components/          — shared UI (Nav, Flash, StarRating, StatusPill, Money)
contracts/           — SCAFFOLD ONLY, no code yet: planned home for the
                        per-job multisig / Soroban escrow contract work
                        described in ARCHITECTURE.md and CONTRIBUTING.md
```

This is intentionally **one Next.js app, not a frontend/backend split** —
routes are Server Components, mutations are Server Actions, there's no
separate REST/GraphQL API. That's a deliberate MVP choice (see
`ARCHITECTURE.md`'s Overview), not an oversight — don't propose splitting it
into separate frontend/backend services without a concrete reason tied to a
real scaling or deployment constraint.

## Core architecture (read `ARCHITECTURE.md` for the full writeup)

- **Auth & wallets**: signup creates a bcrypt-hashed password AND a Stellar
  keypair in the same action. The secret is AES-256-GCM encrypted
  (`lib/crypto.ts`) and stored in `wallet_accounts`; users never see a seed
  phrase (custodial embedded wallet, by deliberate design choice).
- **Job lifecycle** (`jobs.status`, `db/schema.ts`):
  `REQUESTED → ACCEPTED → ESCROW_FUNDED → IN_PROGRESS → COMPLETED_BY_PROVIDER
  → RELEASED`, with `CANCELLED` and `DISPUTED → REFUNDED | RELEASED`
  branches. All transitions live in `lib/actions/jobs.ts`.
- **Escrow**: a platform-custodied Stellar account (not yet a smart
  contract). Every fund movement calls `lib/stellar.ts`'s `sendPayment()`
  and is logged as an `escrow_events` row **before** the job status is
  allowed to change, so on-chain state and app state can never drift apart.
  This is a known, documented tradeoff — the upgrade path (per-job 2-of-3
  multisig, then Soroban via Trustless Work) is `contracts/`'s job, not
  this app's.
- **Live/mock Stellar adapter** (`lib/stellar.ts`): `STELLAR_MODE=live`
  (shipped default) talks to real Stellar testnet via Horizon + Friendbot.
  `STELLAR_MODE=mock` uses a DB-backed simulated ledger with the identical
  function signatures and behavior — built because some sandboxes block
  `*.stellar.org` outbound entirely. **Never call `@stellar/stellar-sdk`
  from anywhere except `lib/stellar.ts`** — every other file goes through
  its exported functions so both modes stay interchangeable.

## Conventions to follow

- Data fetching stays in the page (Server Component); shared UI goes in
  `components/`.
- All mutations are Server Actions in `lib/actions/`, one file per domain
  (`auth.ts`, `provider.ts`, `jobs.ts`). An action either redirects (see the
  `ok()`/`fail()` helpers in `lib/actions/jobs.ts`) or throws — no ad hoc
  JSON error shape.
- Schema changes: edit `db/schema.ts` → `npm run db:generate` (creates a
  migration file) → `npm run db:migrate` (applies it). Commit the generated
  SQL under `drizzle/`.
- Multi-row writes that must be atomic use `db.transaction((tx) => {...})`
  — better-sqlite3's driver is synchronous, so **no `await` inside a
  transaction callback**.

## Commands

```bash
npm install
cp .env.example .env
openssl rand -hex 32   # run twice; paste into JWT_SECRET and
                        # WALLET_ENCRYPTION_KEY in .env

npm run db:setup       # migrate + seed
npm run dev             # http://localhost:3000

npx tsc --noEmit        # typecheck — run before any PR
npm run build            # production build — run before any PR
npm run build && npm run start &   # then, separately:
npm run test:e2e         # Playwright smoke test (16 checks, full lifecycle)
```

`STELLAR_MODE` should stay `live` (the `.env.example` default) on a normal
machine with internet access. Only set it to `mock` if your network blocks
`*.stellar.org`.

## Where to find contribution ideas

`CONTRIBUTING.md` has a ranked, scoped good-first-issues list. The two
highest-value ones (per-job multisig escrow, then Soroban/Trustless Work
integration) are what `contracts/` exists for — check `contracts/README.md`
before starting either.
