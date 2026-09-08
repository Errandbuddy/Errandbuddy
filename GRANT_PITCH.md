# Errandbuddy — GrantFox / Stellar Community Fund pitch

*A working MVP and pitch summary, prepared for submission via
[GrantFox](https://grantfox.xyz) / the Stellar Community Fund. Fields marked
`[ ]` are for you to fill in before submitting — team details, funding ask,
and links this document can't know on its own.*

## One-liner

Errandbuddy is "Upwork for handy jobs" — a local-services marketplace for
Nigeria and West Africa, where every payment is held in a Stellar-secured
escrow until the customer confirms the work is done.

## The problem

Finding a reliable plumber, electrician, or generator technician in Lagos or
Abuja today happens through WhatsApp groups, word of mouth, or a name
scribbled on a business card taped to a shop wall. There is no shared,
portable reputation layer — a great artisan's five years of good work is
invisible to anyone outside their existing customer base. And payment is
binary and risky on both sides: pay up front and hope the artisan shows up, or
pay on completion and hope the work is good, with no recourse either way if it
isn't.

Nigeria's informal economy — where this activity almost entirely sits — is
estimated at roughly 55% of official GDP ([World Economics](https://www.worldeconomics.com/Informal-Economy/Nigeria.aspx)).
That's an enormous amount of local commerce with essentially no shared trust
infrastructure.

## The solution

Errandbuddy gives customers a searchable, location-sorted directory of
artisans with real ratings and reviews from past jobs, and protects both sides
of every transaction with an escrow: the customer's payment moves on-chain the
moment a job is accepted, sits in escrow while the work happens, and only
releases to the artisan once the customer confirms. Either party can raise a
dispute for admin resolution at any point before release. No wallet or crypto
literacy is required — the platform creates and manages a Stellar wallet for
each user automatically.

## Why Stellar

- **Auditability that doesn't require trusting us.** Every escrow funding,
  release, and refund is a real Stellar transaction with a checkable hash —
  not just a row in our database that only we control.
- **Fees that don't eat small jobs' margins.** A ₦5,000 callout fee can't
  absorb card-network or bank-transfer fees the way it can absorb a fraction
  of a cent on Stellar.
- **A real, if partial, trustless story already, with a clear path to a full
  one.** This MVP's escrow is currently platform-custodied for speed (see
  ARCHITECTURE.md) — the roadmap moves it to a per-job multisig and then a
  Soroban smart contract, integrating [Trustless Work](https://www.trustlesswork.com/),
  the escrow protocol GrantFox itself is built on. We see this less as a
  competing project and more as a natural downstream adopter of that
  infrastructure.
- **Ecosystem fit.** A consumer-facing, non-speculative use of Stellar in one
  of its highest-potential markets — real people paying real artisans for real
  work, with the chain doing what it's good at instead of being the point of
  the product.

## Current status (as of this submission)

- Full MVP built and running: signup/login, embedded wallets, provider
  onboarding, location-aware search, job requests, the complete escrow
  lifecycle (fund → complete → confirm & release), disputes with admin
  resolution, and ratings/reviews.
- Seeded with realistic demo data: 10 service categories, 8 artisans across
  Lagos/Abuja/Port Harcourt/Ibadan, sample reviews.
- End-to-end tested: a Playwright suite drives a real browser through the
  full lifecycle (16 checks) against a production build.
- Open-sourced under MIT with a scoped contributor backlog
  (CONTRIBUTING.md) so GrantFox bounty-hunters have concrete, reviewable tasks
  to pick up rather than a vague "help wanted."
- Not yet done: the trustless (multisig/Soroban) escrow upgrade, KYC/provider
  verification, a real NGN on/off-ramp, and any real users. This is
  deliberately an MVP, not a finished product — see ROADMAP.md for the
  sequencing.

## What funding would go toward

1. **The multisig/Soroban escrow upgrade** (CONTRIBUTING.md #1–#2) — the
   single highest-leverage engineering work to make this genuinely trustless,
   likely including a Trustless Work integration and a security review of the
   contract/multisig logic before it holds real user funds.
2. **A real NGN on/off-ramp** via a licensed Stellar anchor (SEP-24/38), so
   customers and artisans can fund and cash out in Naira through their own
   bank, without needing to source XLM themselves.
3. **Provider verification/KYC**, so "Verified" on a profile means something
   backed by an actual review process.
4. **Initial user acquisition** in one Lagos neighborhood or one service
   category, to get real usage data and real reviews before broader rollout.

## Ask

`[ ] Insert requested amount and the specific milestones/timeline you're
committing to in exchange for it — SCF rounds typically want this broken into
concrete, checkable deliverables rather than a lump sum.]`

## Team

`[ ] Add your name(s), relevant background, and links (GitHub, LinkedIn,
prior work) here. SCF reviewers weight team credibility heavily — don't skip
this section.]`

## Links

- Repository: `[ ] add your GitHub URL once pushed]`
- Live demo: `[ ] add a deployed URL if/when you have one — see ROADMAP.md
  Phase 1 for production hardening steps first]`
- This pitch assumes the reviewer has read (or will read) README.md and
  ARCHITECTURE.md for full technical grounding.
