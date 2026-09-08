import "dotenv/config";
import { and, eq, like } from "drizzle-orm";
import { db, schema } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { createFundedAccount, ensurePlatformAccount } from "../lib/stellar";
import { NIGERIAN_CITIES } from "../lib/geo";

const CATEGORIES = [
  { name: "Plumbing", slug: "plumbing", icon: "🚰" },
  { name: "Electrical Wiring", slug: "electrical", icon: "💡" },
  { name: "AC & Refrigeration", slug: "ac-refrigeration", icon: "❄️" },
  { name: "Generator Repair", slug: "generator-repair", icon: "🔌" },
  { name: "Carpentry & Furniture", slug: "carpentry", icon: "🪚" },
  { name: "Painting & POP", slug: "painting-pop", icon: "🎨" },
  { name: "Home Cleaning", slug: "home-cleaning", icon: "🧹" },
  { name: "Moving & Haulage", slug: "moving-haulage", icon: "🚚" },
  { name: "Tiling & Flooring", slug: "tiling-flooring", icon: "🧱" },
  { name: "CCTV & Networking", slug: "cctv-networking", icon: "📷" }
];

const PROVIDERS = [
  {
    name: "Chuka Nwosu",
    email: "chuka.plumber@demo.errandbuddy",
    category: "plumbing",
    city: "Lagos",
    bio: "12 years fixing pipes, tanks and boreholes across Lagos mainland. I bring my own tools and I don't leave a mess.",
    years: 12,
    rate: 25,
    avatar: "🔧"
  },
  {
    name: "Amaka Obi",
    email: "amaka.electrician@demo.errandbuddy",
    category: "electrical",
    city: "Lagos",
    bio: "Licensed electrician — rewiring, generator changeover switches, and inverter installation. NSITF certified.",
    years: 9,
    rate: 30,
    avatar: "⚡"
  },
  {
    name: "Tunde Bakare",
    email: "tunde.ac@demo.errandbuddy",
    category: "ac-refrigeration",
    city: "Abuja",
    bio: "AC installation, gas refill and servicing for split and central units. Same-day callout in Abuja municipal.",
    years: 7,
    rate: 22,
    avatar: "❄️"
  },
  {
    name: "Ifeoma Chukwu",
    email: "ifeoma.cleaning@demo.errandbuddy",
    category: "home-cleaning",
    city: "Lagos",
    bio: "Deep cleaning, move-in/move-out cleaning, and recurring weekly cleaning for homes and short-lets.",
    years: 5,
    rate: 12,
    avatar: "🧽"
  },
  {
    name: "Segun Adewale",
    email: "segun.generator@demo.errandbuddy",
    category: "generator-repair",
    city: "Port Harcourt",
    bio: "Diesel and petrol generator servicing, from small 'I better pass my neighbour' units to industrial sets.",
    years: 15,
    rate: 28,
    avatar: "🛠️"
  },
  {
    name: "Blessing Okoro",
    email: "blessing.carpentry@demo.errandbuddy",
    category: "carpentry",
    city: "Ibadan",
    bio: "Custom wardrobes, kitchen cabinets and furniture repair. I source materials or work with what you have.",
    years: 10,
    rate: 20,
    avatar: "🪑"
  },
  {
    name: "Musa Abdullahi",
    email: "musa.painting@demo.errandbuddy",
    category: "painting-pop",
    city: "Abuja",
    bio: "Interior/exterior painting and POP ceiling design. Free color consultation on jobs above 3 rooms.",
    years: 8,
    rate: 18,
    avatar: "🖌️"
  },
  {
    name: "Grace Eze",
    email: "grace.cctv@demo.errandbuddy",
    category: "cctv-networking",
    city: "Lagos",
    bio: "CCTV installation, WiFi mesh setup, and smart home basics. I'll explain the app, not just install the box.",
    years: 6,
    rate: 26,
    avatar: "📷"
  }
];

const CUSTOMERS = [
  { name: "Wale Johnson", email: "wale.customer@demo.errandbuddy", city: "Lagos" },
  { name: "Ngozi Umeh", email: "ngozi.customer@demo.errandbuddy", city: "Abuja" },
  { name: "David Okafor", email: "david.customer@demo.errandbuddy", city: "Port Harcourt" }
];

async function main() {
  console.log("[seed] ensuring platform escrow account…");
  const platform = await ensurePlatformAccountLogged();

  console.log("[seed] inserting service categories…");
  const categoryIds: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const existing = db
      .select()
      .from(schema.serviceCategories)
      .where(eqSlug(c.slug))
      .get();
    if (existing) {
      categoryIds[c.slug] = existing.id;
      continue;
    }
    const row = db.insert(schema.serviceCategories).values(c).returning().get();
    categoryIds[c.slug] = row.id;
  }

  console.log("[seed] creating demo admin…");
  await upsertUser({
    name: "Errandbuddy Admin",
    email: "admin@demo.errandbuddy",
    role: "ADMIN",
    city: "Lagos"
  });

  console.log(`[seed] creating ${CUSTOMERS.length} demo customers…`);
  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const u = await upsertUser({ name: c.name, email: c.email, role: "CUSTOMER", city: c.city });
    customerIds.push(u.id);
  }

  console.log(`[seed] creating ${PROVIDERS.length} demo artisans (this funds a real testnet wallet per artisan, please wait)…`);
  const providerRows: { userId: string; providerProfileId: string; categoryId: string }[] = [];
  for (const p of PROVIDERS) {
    const u = await upsertUser({ name: p.name, email: p.email, role: "PROVIDER", city: p.city });
    const existingProfile = db
      .select()
      .from(schema.providerProfiles)
      .where(eqUserId(u.id))
      .get();
    let profileId: string;
    if (existingProfile) {
      profileId = existingProfile.id;
    } else {
      const profile = db
        .insert(schema.providerProfiles)
        .values({
          userId: u.id,
          categoryId: categoryIds[p.category],
          bio: p.bio,
          yearsExperience: p.years,
          hourlyRateXLM: p.rate,
          avatarEmoji: p.avatar,
          isVerified: true
        })
        .returning()
        .get();
      profileId = profile.id;
    }
    providerRows.push({ userId: u.id, providerProfileId: profileId, categoryId: categoryIds[p.category] });
  }

  console.log("[seed] seeding a few completed jobs with reviews so ratings show up…");
  const sampleReviews = [
    { rating: 5, comment: "Came on time, fixed the leak in 30 minutes. Would call again." },
    { rating: 5, comment: "Very professional, explained everything before starting work." },
    { rating: 4, comment: "Good job overall, arrived a bit later than agreed." },
    { rating: 5, comment: "Excellent work, fair price, cleaned up after finishing." },
    { rating: 4, comment: "Solid work, will use again for the next job." }
  ];

  let reviewIdx = 0;
  for (const provider of providerRows) {
    const reviewCount = 2 + (reviewIdx % 3); // 2-4 reviews per artisan
    for (let i = 0; i < reviewCount; i++) {
      const customerId = customerIds[(reviewIdx + i) % customerIds.length];
      const review = sampleReviews[(reviewIdx + i) % sampleReviews.length];
      const price = 10 + ((reviewIdx + i) % 5) * 5;

      const existingJob = db
        .select()
        .from(schema.jobs)
        .where(eqDemoJob(customerId, provider.providerProfileId, i))
        .get();
      if (existingJob) continue;

      const job = db
        .insert(schema.jobs)
        .values({
          customerId,
          providerId: provider.userId,
          providerProfileId: provider.providerProfileId,
          categoryId: provider.categoryId,
          title: `Demo completed job #${i + 1}`,
          description: "Seed data: a completed job used to pre-populate ratings for the demo.",
          address: "Seed address",
          city: "Lagos",
          priceXLM: price,
          status: "RELEASED",
          escrowTxHash: "SEED_DATA_NOT_A_REAL_TX",
          releaseTxHash: "SEED_DATA_NOT_A_REAL_TX"
        })
        .returning()
        .get();

      db.insert(schema.reviews)
        .values({
          jobId: job.id,
          reviewerId: customerId,
          revieweeId: provider.userId,
          rating: review.rating,
          comment: review.comment
        })
        .run();
    }
    reviewIdx++;
  }

  console.log("\n[seed] done!\n");
  console.log("Demo login (all demo accounts use password: demo1234):");
  console.log("  Admin:    admin@demo.errandbuddy");
  console.log("  Customer: wale.customer@demo.errandbuddy");
  console.log("  Artisan:  chuka.plumber@demo.errandbuddy");
  console.log(`\nPlatform escrow account: ${platform.publicKey}`);
}

async function upsertUser(opts: { name: string; email: string; role: "CUSTOMER" | "PROVIDER" | "ADMIN"; city: string }) {
  const existing = db.select().from(schema.users).where(eqEmail(opts.email)).get();
  if (existing) return existing;

  const account = await createFundedAccount();
  const cityCenter = NIGERIAN_CITIES[opts.city] ?? NIGERIAN_CITIES.Lagos;
  const passwordHash = await hashPassword("demo1234");

  const user = db
    .insert(schema.users)
    .values({
      name: opts.name,
      email: opts.email,
      passwordHash,
      role: opts.role,
      city: opts.city,
      lat: cityCenter.lat,
      lng: cityCenter.lng
    })
    .returning()
    .get();

  db.insert(schema.walletAccounts)
    .values({
      userId: user.id,
      stellarPublicKey: account.publicKey,
      encryptedSecret: account.encryptedSecret,
      network: process.env.STELLAR_NETWORK ?? "testnet"
    })
    .run();

  console.log(`  + ${opts.role.padEnd(8)} ${opts.name} <${opts.email}>`);
  return user;
}

async function ensurePlatformAccountLogged() {
  return ensurePlatformAccount();
}

// Small helpers kept local so the call sites above stay readable.
function eqSlug(slug: string) {
  return eq(schema.serviceCategories.slug, slug);
}
function eqEmail(email: string) {
  return eq(schema.users.email, email);
}
function eqUserId(userId: string) {
  return eq(schema.providerProfiles.userId, userId);
}
function eqDemoJob(customerId: string, providerProfileId: string, i: number) {
  return and(
    eq(schema.jobs.customerId, customerId),
    eq(schema.jobs.providerProfileId, providerProfileId),
    like(schema.jobs.title, `%#${i + 1}`)
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
