import Link from "next/link";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { haversineKm, formatDistance, NIGERIAN_CITIES } from "@/lib/geo";
import StarRating from "@/components/StarRating";
import Money from "@/components/Money";

type SortKey = "distance" | "rating" | "price";

export default async function SearchPage({
  searchParams
}: {
  searchParams: { category?: string; city?: string; sort?: string; error?: string };
}) {
  const user = await getCurrentUser();
  const categories = db.select().from(schema.serviceCategories).all();

  const city = searchParams.city ?? user?.city ?? "Lagos";
  const origin = (user?.lat && user?.lng ? { lat: user.lat, lng: user.lng } : null) ?? NIGERIAN_CITIES[city] ?? NIGERIAN_CITIES.Lagos;
  const sort: SortKey = (["distance", "rating", "price"] as const).includes(searchParams.sort as SortKey)
    ? (searchParams.sort as SortKey)
    : "distance";

  const providers = await db.query.providerProfiles.findMany({
    with: { user: true, category: true }
  });

  const ratingRows = db
    .select({
      revieweeId: schema.reviews.revieweeId,
      avgRating: sql<number>`avg(${schema.reviews.rating})`,
      count: sql<number>`count(*)`
    })
    .from(schema.reviews)
    .groupBy(schema.reviews.revieweeId)
    .all();
  const ratingsByUser = new Map(ratingRows.map((r) => [r.revieweeId, { avg: r.avgRating, count: r.count }]));

  let results = providers
    .filter((p) => !searchParams.category || p.category.slug === searchParams.category)
    .map((p) => {
      const rating = ratingsByUser.get(p.userId) ?? { avg: 0, count: 0 };
      const distanceKm =
        p.user.lat != null && p.user.lng != null ? haversineKm(origin.lat, origin.lng, p.user.lat, p.user.lng) : null;
      return { ...p, ratingAvg: rating.avg, ratingCount: rating.count, distanceKm };
    });

  results = results.sort((a, b) => {
    if (sort === "rating") return b.ratingAvg - a.ratingAvg;
    if (sort === "price") return a.hourlyRateXLM - b.hourlyRateXLM;
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Find an artisan</h1>
          <p className="text-sm text-ink/60">
            Showing artisans near {city}
            {user ? "" : " — log in and share your location for more precise distances"}.
          </p>
        </div>
      </div>

      <form className="card mb-8 grid gap-3 p-4 sm:grid-cols-4" method="get">
        <select name="category" defaultValue={searchParams.category ?? ""} className="input">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <select name="city" defaultValue={city} className="input">
          {Object.keys(NIGERIAN_CITIES).map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className="input">
          <option value="distance">Nearest first</option>
          <option value="rating">Highest rated</option>
          <option value="price">Lowest rate</option>
        </select>
        <button type="submit" className="btn-primary">
          Update results
        </button>
      </form>

      {results.length === 0 ? (
        <div className="card p-10 text-center text-ink/50">
          No artisans found for this filter yet — try a different category or city.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <Link
              key={p.id}
              href={`/providers/${p.id}`}
              className="card flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-50 text-2xl">
                  {p.avatarEmoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {p.user.name}
                    {p.isVerified && <span className="ml-1 text-brand-500" title="Verified">✔</span>}
                  </p>
                  <p className="truncate text-xs text-ink/50">
                    {p.category.icon} {p.category.name} · {p.user.city}
                  </p>
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-ink/60">{p.bio}</p>
              <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                <StarRating rating={p.ratingAvg} count={p.ratingCount} />
                {p.distanceKm != null && <span className="text-ink/50">{formatDistance(p.distanceKm)}</span>}
              </div>
              <div className="border-t border-ink/10 pt-3">
                <Money xlm={p.hourlyRateXLM} className="text-sm" /> <span className="text-ink/50 text-xs">/ hour</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
