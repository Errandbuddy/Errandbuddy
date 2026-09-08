import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

const COOKIE_NAME = "errandbuddy_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export interface SessionPayload {
  userId: string;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: `${SESSION_DAYS}d` });
}

export function readSessionCookie(): SessionPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, secret()) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** Loads the full current user (with wallet + provider profile) from the
 * session cookie, or null if not signed in. Use in server components/routes. */
export async function getCurrentUser() {
  const session = readSessionCookie();
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    with: { wallet: true, providerProfile: { with: { category: true } } }
  });
  return user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED");
    (err as any).status = 401;
    throw err;
  }
  return user;
}
