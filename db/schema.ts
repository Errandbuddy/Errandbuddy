import { relations } from "drizzle-orm";
import { pgTable, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => timestamp("created_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role", { enum: ["CUSTOMER", "PROVIDER", "ADMIN"] }).notNull(),
  city: text("city"),
  lat: real("lat"),
  lng: real("lng"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const usersRelations = relations(users, ({ one, many }) => ({
  wallet: one(walletAccounts, { fields: [users.id], references: [walletAccounts.userId] }),
  providerProfile: one(providerProfiles, {
    fields: [users.id],
    references: [providerProfiles.userId]
  }),
  jobsAsCustomer: many(jobs, { relationName: "customerJobs" }),
  jobsAsProvider: many(jobs, { relationName: "providerJobs" }),
  reviewsWritten: many(reviews, { relationName: "reviewsWritten" }),
  reviewsReceived: many(reviews, { relationName: "reviewsReceived" })
}));

// ---------------------------------------------------------------------------
// Wallets (custodial Stellar accounts — see lib/stellar.ts)
// ---------------------------------------------------------------------------
export const walletAccounts = pgTable("wallet_accounts", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stellarPublicKey: text("stellar_public_key").notNull().unique(),
  encryptedSecret: text("encrypted_secret").notNull(),
  network: text("network").notNull().default("testnet"),
  createdAt: createdAt()
});

export const walletAccountsRelations = relations(walletAccounts, ({ one }) => ({
  user: one(users, { fields: [walletAccounts.userId], references: [users.id] })
}));

// ---------------------------------------------------------------------------
// The platform's own custodial Stellar account, used as the escrow custodian
// in this MVP (see lib/stellar.ts / ARCHITECTURE.md). Single-row table.
// ---------------------------------------------------------------------------
export const platformAccount = pgTable("platform_account", {
  id: text("id").primaryKey().default("platform"),
  publicKey: text("public_key").notNull().unique(),
  encryptedSecret: text("encrypted_secret").notNull(),
  createdAt: createdAt()
});

// ---------------------------------------------------------------------------
// Simulated ledger balances, used only when STELLAR_MODE=mock — a drop-in
// stand-in for real Stellar testnet balances so the app is fully runnable
// without network access to Stellar's Horizon/Friendbot services (useful in
// sandboxed CI, offline development, or — as in the environment this MVP was
// first built in — a build sandbox with a restrictive network allowlist).
// See lib/stellar.ts for the adapter that switches between this and the real
// Horizon-backed implementation; application code never touches this table
// directly. Not used at all when STELLAR_MODE=live.
// ---------------------------------------------------------------------------
export const mockBalances = pgTable("mock_balances", {
  publicKey: text("public_key").primaryKey(),
  balanceXLM: real("balance_xlm").notNull().default(10000)
});

// ---------------------------------------------------------------------------
// Service categories
// ---------------------------------------------------------------------------
export const serviceCategories = pgTable("service_categories", {
  id: id(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull().default("🛠️")
});

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  providerProfiles: many(providerProfiles),
  jobs: many(jobs)
}));

// ---------------------------------------------------------------------------
// Provider profiles
// ---------------------------------------------------------------------------
export const providerProfiles = pgTable("provider_profiles", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => serviceCategories.id),
  bio: text("bio").notNull(),
  yearsExperience: integer("years_experience").notNull().default(0),
  hourlyRateXLM: real("hourly_rate_xlm").notNull(),
  isVerified: boolean("is_verified").notNull().default(false),
  avatarEmoji: text("avatar_emoji").notNull().default("🧰"),
  createdAt: createdAt()
});

export const providerProfilesRelations = relations(providerProfiles, ({ one, many }) => ({
  user: one(users, { fields: [providerProfiles.userId], references: [users.id] }),
  category: one(serviceCategories, {
    fields: [providerProfiles.categoryId],
    references: [serviceCategories.id]
  }),
  jobs: many(jobs)
}));

// ---------------------------------------------------------------------------
// Jobs (the escrow-backed booking lifecycle)
// ---------------------------------------------------------------------------
export const jobs = pgTable("jobs", {
  id: id(),
  customerId: text("customer_id")
    .notNull()
    .references(() => users.id),
  providerId: text("provider_id")
    .notNull()
    .references(() => users.id),
  providerProfileId: text("provider_profile_id")
    .notNull()
    .references(() => providerProfiles.id),
  categoryId: text("category_id")
    .notNull()
    .references(() => serviceCategories.id),

  title: text("title").notNull(),
  description: text("description").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  lat: real("lat"),
  lng: real("lng"),

  priceXLM: real("price_xlm").notNull(),
  status: text("status", {
    enum: [
      "REQUESTED",
      "ACCEPTED",
      "ESCROW_FUNDED",
      "IN_PROGRESS",
      "COMPLETED_BY_PROVIDER",
      "RELEASED",
      "DISPUTED",
      "CANCELLED",
      "REFUNDED"
    ]
  })
    .notNull()
    .default("REQUESTED"),

  escrowTxHash: text("escrow_tx_hash"),
  releaseTxHash: text("release_tx_hash"),
  refundTxHash: text("refund_tx_hash"),

  disputeReason: text("dispute_reason"),
  disputeRaisedBy: text("dispute_raised_by"),

  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  customer: one(users, {
    fields: [jobs.customerId],
    references: [users.id],
    relationName: "customerJobs"
  }),
  provider: one(users, {
    fields: [jobs.providerId],
    references: [users.id],
    relationName: "providerJobs"
  }),
  providerProfile: one(providerProfiles, {
    fields: [jobs.providerProfileId],
    references: [providerProfiles.id]
  }),
  category: one(serviceCategories, { fields: [jobs.categoryId], references: [serviceCategories.id] }),
  review: one(reviews, { fields: [jobs.id], references: [reviews.jobId] }),
  escrowEvents: many(escrowEvents)
}));

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export const reviews = pgTable("reviews", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .unique()
    .references(() => jobs.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => users.id),
  revieweeId: text("reviewee_id")
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: createdAt()
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  job: one(jobs, { fields: [reviews.jobId], references: [jobs.id] }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: "reviewsWritten"
  }),
  reviewee: one(users, {
    fields: [reviews.revieweeId],
    references: [users.id],
    relationName: "reviewsReceived"
  })
}));

// ---------------------------------------------------------------------------
// Escrow audit trail
// ---------------------------------------------------------------------------
export const escrowEvents = pgTable("escrow_events", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "FUNDED",
      "RELEASED",
      "REFUNDED",
      "DISPUTE_OPENED",
      "DISPUTE_RESOLVED_RELEASE",
      "DISPUTE_RESOLVED_REFUND"
    ]
  }).notNull(),
  stellarTxHash: text("stellar_tx_hash"),
  amountXLM: real("amount_xlm").notNull(),
  note: text("note"),
  createdAt: createdAt()
});

export const escrowEventsRelations = relations(escrowEvents, ({ one }) => ({
  job: one(jobs, { fields: [escrowEvents.jobId], references: [jobs.id] })
}));
