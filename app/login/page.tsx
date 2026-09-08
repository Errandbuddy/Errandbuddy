import Flash from "@/components/Flash";
import { login } from "@/lib/actions/auth";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-ink/60">Log in to manage your jobs and wallet.</p>

      <Flash error={searchParams.error} />

      <form action={login} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required placeholder="••••••••" />
        </div>
        <button type="submit" className="btn-primary w-full py-3">
          Log in
        </button>
        <p className="text-center text-sm text-ink/50">
          New here?{" "}
          <a href="/signup" className="text-brand-600 underline">
            Create an account
          </a>
        </p>
      </form>

      <div className="mt-6 card p-4 text-xs text-ink/50">
        <p className="font-medium text-ink/70">Demo accounts (password: demo1234)</p>
        <p>Customer: wale.customer@demo.errandbuddy</p>
        <p>Artisan: chuka.plumber@demo.errandbuddy</p>
        <p>Admin: admin@demo.errandbuddy</p>
      </div>
    </div>
  );
}
