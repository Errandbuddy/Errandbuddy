import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requestJob } from "@/lib/actions/jobs";
import Flash from "@/components/Flash";
import StarRating from "@/components/StarRating";
import Money from "@/components/Money";

export default async function ProviderProfilePage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();

  const profile = await db.query.providerProfiles.findFirst({
    where: eq(schema.providerProfiles.id, params.id),
    with: { user: true, category: true }
  });
  if (!profile) notFound();

  const reviews = await db.query.reviews.findMany({
    where: eq(schema.reviews.revieweeId, profile.userId),
    with: { reviewer: true },
    orderBy: desc(schema.reviews.createdAt),
    limit: 20
  });

  const ratingAvg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const isOwnProfile = user?.id === profile.userId;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-50 text-3xl">
              {profile.avatarEmoji}
            </span>
            <div>
              <h1 className="text-2xl font-bold">
                {profile.user.name}
                {profile.isVerified && (
                  <span className="ml-2 pill bg-brand-50 text-brand-700 align-middle text-xs">✔ Verified</span>
                )}
              </h1>
              <p className="mt-1 text-sm text-ink/60">
                {profile.category.icon} {profile.category.name} · {profile.user.city} ·{" "}
                {profile.yearsExperience} yr{profile.yearsExperience === 1 ? "" : "s"} experience
              </p>
              <div className="mt-2">
                <StarRating rating={ratingAvg} count={reviews.length} size="md" />
              </div>
            </div>
          </div>
          <p className="mt-5 whitespace-pre-line text-ink/70">{profile.bio}</p>
          <div className="mt-5 border-t border-ink/10 pt-4">
            <Money xlm={profile.hourlyRateXLM} /> <span className="text-sm text-ink/50">/ hour (starting estimate)</span>
          </div>
        </div>

        <div className="card mt-6 p-6">
          <h2 className="mb-4 font-semibold">Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-ink/50">No reviews yet — be the first to book this artisan.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-ink/10 pb-4 last:border-none last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.reviewer.name}</span>
                    <StarRating rating={r.rating} />
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <Flash error={searchParams.error} />
        {isOwnProfile ? (
          <div className="card p-6 text-sm text-ink/60">
            This is your public profile.{" "}
            <a href="/onboarding/provider" className="text-brand-600 underline">
              Edit it
            </a>
            .
          </div>
        ) : !user ? (
          <div className="card p-6">
            <p className="text-sm text-ink/60">Log in to request a job from {profile.user.name}.</p>
            <a href="/login" className="btn-primary mt-4 w-full">
              Log in
            </a>
          </div>
        ) : (
          <form action={requestJob} className="card sticky top-20 space-y-4 p-6">
            <h2 className="font-semibold">Request this artisan</h2>
            <input type="hidden" name="providerProfileId" value={profile.id} />
            <div>
              <label className="label" htmlFor="title">What do you need done?</label>
              <input className="input" id="title" name="title" required placeholder="e.g. Fix leaking kitchen tap" />
            </div>
            <div>
              <label className="label" htmlFor="description">Details</label>
              <textarea
                className="input min-h-[90px]"
                id="description"
                name="description"
                required
                placeholder="Describe the issue, access instructions, preferred time, etc."
              />
            </div>
            <div>
              <label className="label" htmlFor="address">Address</label>
              <input className="input" id="address" name="address" required placeholder="Street, area" />
            </div>
            <div>
              <label className="label" htmlFor="priceXLM">Agreed price (XLM)</label>
              <input
                className="input"
                id="priceXLM"
                name="priceXLM"
                type="number"
                min={1}
                step="0.5"
                required
                defaultValue={profile.hourlyRateXLM * 2}
              />
              <p className="mt-1 text-xs text-ink/40">
                Their rate is {profile.hourlyRateXLM} XLM/hr — set a total for the whole job. You'll agree the
                final scope with them before funding escrow.
              </p>
            </div>
            <button type="submit" className="btn-primary w-full py-3">
              Send request
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
