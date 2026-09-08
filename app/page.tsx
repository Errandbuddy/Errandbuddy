import Link from "next/link";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  const categories = db.select().from(schema.serviceCategories).all();

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-6 sm:pt-10 lg:grid-cols-2">
        <div>
          <span className="pill bg-brand-50 text-brand-700 mb-4">
            🌍 Built for Nigeria &amp; West Africa · Powered by Stellar
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Find a trusted artisan nearby.
            <br />
            <span className="text-brand-500">Pay only when the job's done.</span>
          </h1>
          <p className="mt-5 text-lg text-ink/60">
            Errandbuddy connects you with verified plumbers, electricians, cleaners and other local
            artisans near you — with real ratings and reviews from past customers. Every payment sits
            in a Stellar-secured escrow until you confirm the work, so nobody pays or works on trust
            alone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/search" : "/signup"} className="btn-primary px-6 py-3 text-base">
              I need a job done
            </Link>
            <Link
              href={user ? "/dashboard" : "/signup?role=PROVIDER"}
              className="btn-secondary px-6 py-3 text-base"
            >
              I'm an artisan
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink/40">
            No wallet or crypto experience needed — we create and manage your Stellar wallet for you.
          </p>
        </div>

        <div className="card p-6">
          <p className="mb-4 text-sm font-medium text-ink/60">How the escrow works</p>
          <ol className="space-y-4">
            {[
              ["1", "Book & agree a price", "Request a job from an artisan's profile and agree the price up front."],
              ["2", "Funds lock in escrow", "Your payment moves on-chain into a Stellar escrow the moment the artisan accepts — not to them yet."],
              ["3", "Work happens", "The artisan does the job. You can raise a dispute at any point if something's wrong."],
              ["4", "You confirm, they get paid", "One tap releases the on-chain payment and prompts you to leave a rating."]
            ].map(([n, title, body]) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-stellar-500 text-xs font-semibold text-white">
                  {n}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-ink/55">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Categories */}
      <section>
        <h2 className="mb-5 text-xl font-semibold">Popular services</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/search?category=${c.slug}`}
              className="card flex flex-col items-center gap-2 px-4 py-6 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="text-sm font-medium">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why Stellar */}
      <section className="card grid gap-8 p-8 lg:grid-cols-3">
        <div>
          <h2 className="text-xl font-semibold">Why this is built on Stellar</h2>
          <p className="mt-2 text-sm text-ink/60">
            Local services are a trust problem as much as a discovery problem. Stellar gives us
            settlement that's fast, near-zero-fee, and independently auditable — a better foundation
            for escrow than a black-box ledger only the platform can see.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-ink/70 lg:col-span-2">
          <li className="flex gap-2">
            <span>💸</span>
            <span>
              <strong>Escrow that's actually visible.</strong> Every funding, release and refund is a
              real Stellar transaction — anyone can verify it on a block explorer, not just trust our
              database.
            </span>
          </li>
          <li className="flex gap-2">
            <span>⚡</span>
            <span>
              <strong>Settlement in seconds, fees in fractions of a cent.</strong> That matters for
              small jobs where card or bank fees would eat the artisan's margin.
            </span>
          </li>
          <li className="flex gap-2">
            <span>🧱</span>
            <span>
              <strong>A foundation to build on, not a finished product.</strong> This MVP uses a
              platform-custodied escrow account for speed; the roadmap moves to a per-job multisig or
              Soroban smart-contract escrow (e.g. via Trustless Work) so no single party — including
              us — can move funds unilaterally. See ROADMAP.md.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
