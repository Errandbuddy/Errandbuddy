# contracts/

**Status: scaffold only — no contract code lives here yet.** This folder is
the designated home for Errandbuddy's on-chain escrow work, so the two
highest-priority items in [`CONTRIBUTING.md`](../CONTRIBUTING.md) have a
concrete place to start rather than a vague "someone should build this."

Today, escrow is a platform-custodied Stellar account: real on-chain
payments, but the platform technically holds the keys (see
[`ARCHITECTURE.md`](../ARCHITECTURE.md#the-job-lifecycle--escrow-design) for
the full, honest writeup of that tradeoff). The work in this folder removes
that trust assumption in two stages.

## Stage 1 — per-job 2-of-3 multisig (classic Stellar, no Soroban needed)

The single highest-value contribution available on this repo. For each job,
create a dedicated Stellar account with the customer, the artisan, and the
platform as signers (weight 1 each), threshold set to require 2 signatures
for any payment. Release then requires the platform to co-sign with
whichever party agrees — the platform alone can no longer move funds
unilaterally.

Planned layout once work starts:

```
contracts/
  multisig/
    README.md         — the multisig account-setup + signing flow, in detail
    src/               — TypeScript helpers (this stays classic Stellar SDK,
                          called from lib/stellar.ts's live-mode path — no
                          separate deploy step, no new runtime)
```

This stage is pure application code (no Soroban, no separate deployment) —
it plugs into the existing `lib/stellar.ts` adapter described in
`ARCHITECTURE.md`.

## Stage 2 — Soroban smart-contract escrow via Trustless Work

Encode the job state machine itself on-chain (fund / release / refund /
dispute as contract calls), so the rules are enforced by the ledger, not
just by this app's server. [Trustless Work](https://www.trustlesswork.com/)
already provides a reusable Soroban escrow protocol — and is what GrantFox
itself is built on — so integrating it is the pragmatic path, rather than
writing a contract from scratch.

Planned layout once work starts:

```
contracts/
  soroban-escrow/
    Cargo.toml         — Soroban contract crate (or a thin integration crate
                          against the Trustless Work SDK)
    src/
      lib.rs
    README.md           — deployment + testnet invocation instructions
```

## Why this isn't a working Cargo project yet

This scaffold exists to give a contributor a clear starting point and to
show reviewers the architecture is genuinely designed for this upgrade, not
just gestured at. It deliberately stops short of a stub Cargo workspace or
placeholder contract code — an unverified or non-compiling contract skeleton
would be worse than no skeleton at all. The first PR against either stage
above should include its own working build from the start.

## Before starting either stage

Read, in order: `ARCHITECTURE.md`'s escrow section, `CONTRIBUTING.md`'s
issues #1 and #2, and `lib/stellar.ts` (the adapter both stages plug into).
Open an issue describing your approach before a large PR — the multisig
signer/threshold design in particular has a few subtle edge cases (what
happens if a signer never responds; how a dispute forces the platform's
co-signature) worth agreeing on first.
