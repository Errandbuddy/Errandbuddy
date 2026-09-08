"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashPassword, verifyPassword, signSession, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { createFundedAccount } from "@/lib/stellar";
import { NIGERIAN_CITIES } from "@/lib/geo";

type Role = "CUSTOMER" | "PROVIDER" | "ADMIN";

export async function signup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "CUSTOMER");
  const city = String(formData.get("city") ?? "Lagos");
  const role: Role = roleRaw === "PROVIDER" ? "PROVIDER" : "CUSTOMER";

  if (!name || !email || password.length < 8) {
    redirect(
      `/signup?error=${encodeURIComponent("Please fill in your name, a valid email, and a password of at least 8 characters.")}&role=${role}`
    );
  }

  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists. Try logging in instead.")}&role=${role}`);
  }

  const passwordHash = await hashPassword(password);
  const cityCenter = NIGERIAN_CITIES[city] ?? NIGERIAN_CITIES.Lagos;

  let account;
  try {
    account = await createFundedAccount();
  } catch (err) {
    console.error("[signup] failed to create Stellar wallet", err);
    redirect(
      `/signup?error=${encodeURIComponent("We couldn't create your Stellar wallet right now (testnet may be temporarily unavailable). Please try again in a minute.")}&role=${role}`
    );
  }

  const user = db
    .insert(schema.users)
    .values({
      name,
      email,
      passwordHash,
      phone: phone || null,
      role,
      city,
      lat: cityCenter.lat,
      lng: cityCenter.lng
    })
    .returning()
    .get();

  db.insert(schema.walletAccounts)
    .values({
      userId: user.id,
      stellarPublicKey: account!.publicKey,
      encryptedSecret: account!.encryptedSecret,
      network: process.env.STELLAR_NETWORK ?? "testnet"
    })
    .run();

  setSessionCookie(signSession({ userId: user.id, role: user.role as Role }));

  if (role === "PROVIDER") {
    redirect("/onboarding/provider");
  }
  redirect("/search");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect(`/login?error=${encodeURIComponent("Incorrect email or password.")}`);
  }

  setSessionCookie(signSession({ userId: user!.id, role: user!.role as Role }));
  redirect("/dashboard");
}

export async function logout() {
  clearSessionCookie();
  redirect("/");
}
