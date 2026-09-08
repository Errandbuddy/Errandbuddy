import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getXlmBalance, explorerAccountUrl, isMockMode } from "@/lib/stellar";
import Money from "@/components/Money";

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.wallet) {
    return <div className="card p-6 text-sm text-ink/60">No wallet found for this account.</div>;
  }

  const balance = await getXlmBalance(user.wallet.stellarPublicKey);
  const accountUrl = explorerAccountUrl(user.wallet.stellarPublicKey);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Your wallet</h1>
      <p className="mt-1 text-sm text-ink/60">
        Errandbuddy created and manages this Stellar {isMockMode() ? "(simulated) " : ""}wallet for you —
        no seed phrase to lose.
      </p>

      <div className="card mt-6 p-6">
        <p className="text-xs uppercase tracking-wide text-ink/40">Balance</p>
        <p className="mt-1 text-3xl font-bold">
          <Money xlm={balance} />
        </p>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="text-xs uppercase tracking-wide text-ink/40">Public address</p>
          <p className="mt-1 break-all font-mono text-xs text-ink/70">{user.wallet.stellarPublicKey}</p>
          {accountUrl ? (
            <a href={accountUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-600 underline">
              View on Stellar Expert
            </a>
          ) : (
            <p className="mt-2 text-xs text-ink/40">
              Running in simulated-ledger mode — there's no real on-chain explorer entry for this
              account. Set STELLAR_MODE=live to use real Stellar testnet.
            </p>
          )}
        </div>
      </div>

      <div className="card mt-4 p-4 text-xs text-ink/50">
        Your secret key never leaves the server and is encrypted at rest (AES-256-GCM). See
        ARCHITECTURE.md for the custodial-vs-non-custodial tradeoffs and the upgrade path.
      </div>
    </div>
  );
}
