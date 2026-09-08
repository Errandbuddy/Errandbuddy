import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="text-2xl">🧰</span>
          <span>
            Errand<span className="text-brand-500">buddy</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/search" className="btn-ghost hidden sm:inline-flex">
            Find an artisan
          </Link>
          {user && (
            <>
              <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
                Dashboard
              </Link>
              <Link href="/wallet" className="btn-ghost hidden sm:inline-flex">
                Wallet
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin/disputes" className="btn-ghost hidden sm:inline-flex">
                  Disputes
                </Link>
              )}
            </>
          )}

          {user ? (
            <form action={logout}>
              <button type="submit" className="btn-secondary">
                Log out
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
