/** Demo-only NGN display helper. This is NOT a live FX rate — it's a fixed
 * constant so users see a familiar currency next to on-chain XLM amounts.
 * A production build would price jobs in a stable asset (USDC on Stellar)
 * and get NGN quotes from a licensed Stellar anchor (SEP-38) — see
 * ROADMAP.md. */
const RATE = Number(process.env.DEMO_XLM_TO_NGN_RATE ?? "165");

export function xlmToNgnEstimate(xlm: number): string {
  const ngn = xlm * RATE;
  return `₦${ngn.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function formatXLM(xlm: number): string {
  return `${xlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM`;
}
