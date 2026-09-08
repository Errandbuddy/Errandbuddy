import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusPill from "@/components/StatusPill";
import Money from "@/components/Money";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "ADMIN") {
    const [openDisputes, allJobs, released] = await Promise.all([
      db.select().from(schema.jobs).where(eq(schema.jobs.status, "DISPUTED")),
      db.select().from(schema.jobs),
      db.select().from(schema.jobs).where(eq(schema.jobs.status, "RELEASED"))
    ]);
    const volume = released.reduce((s, j) => s + j.priceXLM, 0);

    return (
      <div>
        <h1 className="text-2xl font-bold">Admin overview</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Total jobs" value={String(allJobs.length)} />
          <Stat label="Open disputes" value={String(openDisputes.length)} highlight={openDisputes.length > 0} />
          <Stat label="Volume settled" value={`${volume} XLM`} />
        </div>
        <Link href="/admin/disputes" className="btn-primary mt-6 inline-flex">
          Review disputes →
        </Link>
      </div>
    );
  }

  const jobsAsCustomer =
    user.role === "CUSTOMER"
      ? await db.query.jobs.findMany({
          where: eq(schema.jobs.customerId, user.id),
          with: { provider: true, category: true },
          orderBy: desc(schema.jobs.updatedAt)
        })
      : [];

  const jobsAsProvider =
    user.role === "PROVIDER"
      ? await db.query.jobs.findMany({
          where: eq(schema.jobs.providerId, user.id),
          with: { customer: true, category: true },
          orderBy: desc(schema.jobs.updatedAt)
        })
      : [];

  const earnings =
    user.role === "PROVIDER"
      ? jobsAsProvider.filter((j) => j.status === "RELEASED").reduce((s, j) => s + j.priceXLM, 0)
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome back, {user.name.split(" ")[0]}</h1>
        {user.role === "CUSTOMER" && (
          <Link href="/search" className="btn-primary">Find an artisan</Link>
        )}
      </div>

      {user.role === "PROVIDER" && !user.providerProfile && (
        <div className="card mt-6 border-brand-200 bg-brand-50 p-4 text-sm">
          Your artisan profile isn't set up yet.{" "}
          <Link href="/onboarding/provider" className="font-medium text-brand-700 underline">
            Finish setup
          </Link>{" "}
          so customers can find and book you.
        </div>
      )}

      {user.role === "PROVIDER" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Total jobs" value={String(jobsAsProvider.length)} />
          <Stat
            label="Awaiting action"
            value={String(jobsAsProvider.filter((j) => !["RELEASED", "CANCELLED", "REFUNDED"].includes(j.status)).length)}
          />
          <Stat label="Earned (released)" value={`${earnings} XLM`} />
        </div>
      )}

      <h2 className="mt-8 mb-3 font-semibold">
        {user.role === "PROVIDER" ? "My jobs" : "My job requests"}
      </h2>
      <JobList jobs={user.role === "PROVIDER" ? jobsAsProvider : jobsAsCustomer} viewerRole={user.role} />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? "border-red-300 bg-red-50" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-ink/40">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function JobList({
  jobs,
  viewerRole
}: {
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    priceXLM: number;
    updatedAt: Date;
    category: { icon: string; name: string };
    provider?: { name: string };
    customer?: { name: string };
  }>;
  viewerRole: string;
}) {
  if (jobs.length === 0) {
    return <div className="card p-10 text-center text-sm text-ink/50">No jobs yet.</div>;
  }
  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <Link key={j.id} href={`/jobs/${j.id}`} className="card flex items-center justify-between gap-4 p-4 hover:shadow-lg">
          <div className="min-w-0">
            <p className="truncate font-medium">{j.title}</p>
            <p className="truncate text-xs text-ink/50">
              {j.category.icon} {j.category.name} ·{" "}
              {viewerRole === "PROVIDER" ? j.customer?.name : j.provider?.name} ·{" "}
              {new Date(j.updatedAt).toLocaleDateString("en-NG")}
            </p>
          </div>
          <div className="flex flex-none items-center gap-3">
            <Money xlm={j.priceXLM} className="hidden text-sm sm:inline" />
            <StatusPill status={j.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
