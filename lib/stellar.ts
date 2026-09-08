import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE
} from "@stellar/stellar-sdk";
import { decryptSecret, encryptSecret } from "./crypto";
import { db, schema } from "./db";

/**
 * All Stellar wiring for Errandbuddy lives here, behind a small adapter so
 * the rest of the app (lib/actions/jobs.ts in particular) never knows or
 * cares whether it's talking to real Stellar testnet or a simulated ledger.
 *
 * MVP design (see ARCHITECTURE.md for the full writeup):
 *  - Every user gets an embedded, custodial Stellar account created at
 *    signup, so non-crypto-native customers and artisans never see a seed
 *    phrase.
 *  - Job payments settle in native XLM for simplicity (no trustline setup
 *    needed for a demo). A production build would settle in a USD or
 *    NGN-pegged asset via a licensed Stellar anchor — see ROADMAP.md.
 *  - Escrow is modeled as a platform-controlled custodian account: the
 *    customer's payment is a real on-chain transfer into the platform's
 *    escrow account when a job is accepted, and release/refund are real
 *    on-chain transfers out of it, driven by the app's job-status state
 *    machine. Every movement is logged as an EscrowEvent with its Stellar
 *    transaction hash, so the whole payment trail is publicly auditable on
 *    Stellar Expert even though custody is centralized in this MVP.
 *    Upgrading to a per-job multisig or Soroban smart-contract escrow (e.g.
 *    integrating Trustless Work, which GrantFox itself is built on) so the
 *    platform can't unilaterally move funds is the headline "good first
 *    contribution" — see ROADMAP.md.
 *
 * STELLAR_MODE:
 *  - "live" (default): real Stellar testnet via Horizon + Friendbot. This is
 *    what a normal clone of this repo runs, and what you want for any real
 *    demo — every payment is independently verifiable on Stellar Expert.
 *  - "mock": a DB-backed simulated ledger with the identical interface,
 *    balances and insufficient-funds behavior, but no network calls. This
 *    exists because the sandbox this MVP was first built in blocks outbound
 *    access to *.stellar.org entirely — set STELLAR_MODE=mock to keep
 *    developing/demoing offline or in a similarly locked-down CI runner.
 *    Swapping back to "live" requires no application code changes.
 */

const NETWORK = process.env.STELLAR_NETWORK ?? "testnet";
const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = process.env.STELLAR_FRIENDBOT_URL ?? "https://friendbot.stellar.org";
const MODE = (process.env.STELLAR_MODE ?? "live").toLowerCase();

export function isMockMode(): boolean {
  return MODE === "mock";
}

export const NETWORK_PASSPHRASE = NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

let _server: Horizon.Server | null = null;
export function server(): Horizon.Server {
  if (!_server) _server = new Horizon.Server(HORIZON_URL);
  return _server;
}

export interface FundedAccount {
  publicKey: string;
  encryptedSecret: string;
}

// ---------------------------------------------------------------------------
// Account creation
// ---------------------------------------------------------------------------

async function createFundedAccountLive(): Promise<FundedAccount> {
  if (NETWORK === "mainnet") {
    throw new Error(
      "Mainnet account funding is not implemented in this MVP. See ROADMAP.md for the anchor on-ramp plan."
    );
  }
  const keypair = Keypair.random();
  const resp = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(keypair.publicKey())}`);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Friendbot funding failed (${resp.status}): ${body}`);
  }
  return { publicKey: keypair.publicKey(), encryptedSecret: encryptSecret(keypair.secret()) };
}

async function createFundedAccountMock(): Promise<FundedAccount> {
  const keypair = Keypair.random();
  await db.insert(schema.mockBalances)
    .values({ publicKey: keypair.publicKey(), balanceXLM: 10000 });
  return { publicKey: keypair.publicKey(), encryptedSecret: encryptSecret(keypair.secret()) };
}

export async function createFundedAccount(): Promise<FundedAccount> {
  return isMockMode() ? createFundedAccountMock() : createFundedAccountLive();
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export async function getXlmBalance(publicKey: string): Promise<number> {
  if (isMockMode()) {
    const [row] = await db.select().from(schema.mockBalances).where(eq(schema.mockBalances.publicKey, publicKey));
    return row?.balanceXLM ?? 0;
  }
  try {
    const account = await server().loadAccount(publicKey);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? parseFloat(native.balance) : 0;
  } catch (err: any) {
    if (err?.response?.status === 404) return 0;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface SendPaymentParams {
  fromEncryptedSecret: string;
  toPublicKey: string;
  amountXLM: number;
  memo?: string;
}

async function sendPaymentMock(params: SendPaymentParams): Promise<string> {
  const sourceKeypair = Keypair.fromSecret(decryptSecret(params.fromEncryptedSecret));
  const fromPk = sourceKeypair.publicKey();

  const [fromRow] = await db.select().from(schema.mockBalances).where(eq(schema.mockBalances.publicKey, fromPk));
  const currentBalance = fromRow?.balanceXLM ?? 0;
  if (currentBalance < params.amountXLM) {
    throw new Error(
      `Insufficient balance: account has ${currentBalance.toFixed(2)} XLM, tried to send ${params.amountXLM} XLM`
    );
  }

  const hash = `MOCK${randomUUID().replace(/-/g, "").toUpperCase()}`;

  await db.transaction(async (tx) => {
    await tx.update(schema.mockBalances)
      .set({ balanceXLM: currentBalance - params.amountXLM })
      .where(eq(schema.mockBalances.publicKey, fromPk));

    const [toRow] = await tx
      .select()
      .from(schema.mockBalances)
      .where(eq(schema.mockBalances.publicKey, params.toPublicKey));
    if (toRow) {
      await tx.update(schema.mockBalances)
        .set({ balanceXLM: toRow.balanceXLM + params.amountXLM })
        .where(eq(schema.mockBalances.publicKey, params.toPublicKey));
    } else {
      await tx.insert(schema.mockBalances)
        .values({ publicKey: params.toPublicKey, balanceXLM: params.amountXLM });
    }
  });

  return hash;
}

async function sendPaymentLive(params: SendPaymentParams): Promise<string> {
  const sourceKeypair = Keypair.fromSecret(decryptSecret(params.fromEncryptedSecret));
  const sourceAccount = await server().loadAccount(sourceKeypair.publicKey());

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(
      Operation.payment({
        destination: params.toPublicKey,
        asset: Asset.native(),
        amount: params.amountXLM.toFixed(7)
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(sourceKeypair);
  const result = await server().submitTransaction(tx);
  return result.hash;
}

/**
 * Send a native-XLM payment from one custodial account to another, signed
 * server-side with the sender's decrypted key. Returns a transaction hash so
 * callers can log it and (in live mode) link to Stellar Expert.
 */
export async function sendPayment(params: SendPaymentParams): Promise<string> {
  return isMockMode() ? sendPaymentMock(params) : sendPaymentLive(params);
}

// ---------------------------------------------------------------------------
// Explorer links (live mode only — a simulated ledger has nothing to show)
// ---------------------------------------------------------------------------

export function explorerTxUrl(hash: string): string | null {
  if (isMockMode() || hash.startsWith("MOCK") || hash === "SEED_DATA_NOT_A_REAL_TX") return null;
  const base = NETWORK === "mainnet" ? "https://stellar.expert/explorer/public" : "https://stellar.expert/explorer/testnet";
  return `${base}/tx/${hash}`;
}

export function explorerAccountUrl(publicKey: string): string | null {
  if (isMockMode()) return null;
  const base = NETWORK === "mainnet" ? "https://stellar.expert/explorer/public" : "https://stellar.expert/explorer/testnet";
  return `${base}/account/${publicKey}`;
}

// ---------------------------------------------------------------------------
// Platform escrow account
// ---------------------------------------------------------------------------

/** Ensures the platform escrow account exists, creating + funding one on
 * first use and persisting it in the database (so it's stable across
 * restarts without any manual .env copy-pasting). */
export async function ensurePlatformAccount(): Promise<FundedAccount> {
  const [existing] = await db.select().from(schema.platformAccount);
  if (existing) return { publicKey: existing.publicKey, encryptedSecret: existing.encryptedSecret };

  const account = await createFundedAccount();
  await db.insert(schema.platformAccount)
    .values({ publicKey: account.publicKey, encryptedSecret: account.encryptedSecret });

  // eslint-disable-next-line no-console
  console.warn(
    `\n[stellar] Created a new platform escrow account (${MODE} mode): ${account.publicKey}\n`
  );
  return account;
}
