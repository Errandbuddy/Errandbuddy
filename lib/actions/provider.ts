"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { NIGERIAN_CITIES } from "@/lib/geo";

export async function completeProviderOnboarding(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "PROVIDER") {
    redirect("/dashboard");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const bio = String(formData.get("bio") ?? "").trim();
  const yearsExperience = Number(formData.get("yearsExperience") ?? 0);
  const hourlyRateXLM = Number(formData.get("hourlyRateXLM") ?? 0);
  const avatarEmoji = String(formData.get("avatarEmoji") ?? "🧰");
  const city = String(formData.get("city") ?? user.city ?? "Lagos");

  if (!categoryId || bio.length < 10 || !(hourlyRateXLM > 0)) {
    redirect(
      `/onboarding/provider?error=${encodeURIComponent(
        "Please choose a category, write a short bio (10+ characters), and set a rate above 0."
      )}`
    );
  }

  const cityCenter = NIGERIAN_CITIES[city] ?? NIGERIAN_CITIES.Lagos;

  db.update(schema.users)
    .set({ city, lat: cityCenter.lat, lng: cityCenter.lng })
    .where(eq(schema.users.id, user.id))
    .run();

  db.insert(schema.providerProfiles)
    .values({ userId: user.id, categoryId, bio, yearsExperience, hourlyRateXLM, avatarEmoji })
    .onConflictDoUpdate({
      target: schema.providerProfiles.userId,
      set: { categoryId, bio, yearsExperience, hourlyRateXLM, avatarEmoji }
    })
    .run();

  revalidatePath("/search");
  redirect("/dashboard");
}

/** Called from a client component using navigator.geolocation to refine a
 * user's exact coordinates beyond their city's centroid, so distance sorting
 * in /search is meaningful. */
export async function updateMyLocation(lat: number, lng: number) {
  const user = await requireUser();
  db.update(schema.users).set({ lat, lng }).where(eq(schema.users.id, user.id)).run();
  revalidatePath("/search");
}
