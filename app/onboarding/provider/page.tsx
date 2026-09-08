import { redirect } from "next/navigation";
import Flash from "@/components/Flash";
import { getCurrentUser } from "@/lib/auth";
import { completeProviderOnboarding } from "@/lib/actions/provider";
import { db, schema } from "@/lib/db";
import { NIGERIAN_CITIES } from "@/lib/geo";

const AVATARS = ["🧰", "🔧", "⚡", "❄️", "🧹", "🪚", "🖌️", "🪑", "📷", "🛠️"];

export default async function ProviderOnboardingPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "PROVIDER") redirect("/dashboard");

  const categories = db.select().from(schema.serviceCategories).all();
  const existing = user.providerProfile;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Set up your artisan profile</h1>
      <p className="mt-1 text-sm text-ink/60">
        This is what customers see when deciding whether to book you. Be specific about what you do.
      </p>

      <Flash error={searchParams.error} />

      <form action={completeProviderOnboarding} className="card mt-6 space-y-4 p-6">
        <div>
          <span className="label">Avatar</span>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((emoji) => (
              <label key={emoji} className="cursor-pointer">
                <input
                  type="radio"
                  name="avatarEmoji"
                  value={emoji}
                  defaultChecked={(existing?.avatarEmoji ?? "🧰") === emoji}
                  className="peer sr-only"
                />
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-xl peer-checked:border-brand-500 peer-checked:bg-brand-50">
                  {emoji}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="categoryId">Category</label>
          <select className="input" id="categoryId" name="categoryId" defaultValue={existing?.categoryId ?? ""} required>
            <option value="" disabled>
              Choose your main trade
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="bio">Bio</label>
          <textarea
            className="input min-h-[100px]"
            id="bio"
            name="bio"
            required
            minLength={10}
            defaultValue={existing?.bio}
            placeholder="What do you specialize in? Years of experience, certifications, tools you bring…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="yearsExperience">Years of experience</label>
            <input
              className="input"
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              max={60}
              defaultValue={existing?.yearsExperience ?? 2}
            />
          </div>
          <div>
            <label className="label" htmlFor="hourlyRateXLM">Rate (XLM / hour)</label>
            <input
              className="input"
              id="hourlyRateXLM"
              name="hourlyRateXLM"
              type="number"
              min={1}
              step="0.5"
              required
              defaultValue={existing?.hourlyRateXLM ?? 20}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="city">City you work in</label>
          <select className="input" id="city" name="city" defaultValue={user.city ?? "Lagos"}>
            {Object.keys(NIGERIAN_CITIES).map((city) => (
              <option key={city} value={city}>
                {city.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary w-full py-3">
          {existing ? "Save changes" : "Finish setup"}
        </button>
      </form>
    </div>
  );
}
