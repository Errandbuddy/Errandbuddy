import Flash from "@/components/Flash";
import { signup } from "@/lib/actions/auth";
import { NIGERIAN_CITIES } from "@/lib/geo";

export default function SignupPage({
  searchParams
}: {
  searchParams: { error?: string; role?: string };
}) {
  const role = searchParams.role === "PROVIDER" ? "PROVIDER" : "CUSTOMER";

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-ink/60">
        We'll set up a Stellar wallet for you automatically — no crypto experience needed.
      </p>

      <Flash error={searchParams.error} />

      <form action={signup} className="card mt-6 space-y-4 p-6">
        <div>
          <span className="label">I want to…</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer">
              <input type="radio" name="role" value="CUSTOMER" defaultChecked={role === "CUSTOMER"} className="peer sr-only" />
              <div className="rounded-lg border border-ink/15 px-3 py-2.5 text-center text-sm peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:font-medium">
                📋 Hire an artisan
              </div>
            </label>
            <label className="cursor-pointer">
              <input type="radio" name="role" value="PROVIDER" defaultChecked={role === "PROVIDER"} className="peer sr-only" />
              <div className="rounded-lg border border-ink/15 px-3 py-2.5 text-center text-sm peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:font-medium">
                🧰 Work as an artisan
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input className="input" id="name" name="name" required placeholder="Ada Lovelace" />
        </div>

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required placeholder="you@example.com" />
        </div>

        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input className="input" id="phone" name="phone" placeholder="080X XXX XXXX" />
        </div>

        <div>
          <label className="label" htmlFor="city">City</label>
          <select className="input" id="city" name="city" defaultValue="Lagos">
            {Object.keys(NIGERIAN_CITIES).map((city) => (
              <option key={city} value={city}>
                {city.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
        </div>

        <button type="submit" className="btn-primary w-full py-3">
          Create account
        </button>

        <p className="text-center text-sm text-ink/50">
          Already have an account?{" "}
          <a href="/login" className="text-brand-600 underline">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}
