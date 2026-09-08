import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

// Standard dev-mode singleton so Next.js hot-reload doesn't reopen the
// database connection on every module reload.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

const url = resolveDatabaseUrl();
const isLocal = /localhost|127\.0\.0\.1/.test(url);

const client = globalForDb.pgClient ?? postgres(url, isLocal ? {} : { ssl: "require" });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
