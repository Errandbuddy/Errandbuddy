import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import Money from "@/components/Money";

export default async function AdminDisputesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const disputes = await db.query.jobs.findMany({
    where: eq(schema.jobs.status, "DISPUTED"),
    with: { customer: true, provider: true, category: true },
    orderBy: desc(schema.jobs.updatedAt)
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Open disputes</h1>
      <p className="mt-1 text-sm text-ink/60">
        Resolve by releasing escrow to the artisan or refunding the customer. Both actions submit a real
        {" "}
        {"Stellar payment"} from the platform escrow account.
      </p>

      {disputes.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-sm text-ink/50">No open disputes 🎉</div>
      ) : (
        <div className="mt-6 space-y-3">
          {disputes.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="card block p-4 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{j.title}</p>
                  <p className="text-xs text-ink/50">
                    {j.customer.name} ↔ {j.provider.name} · {j.category.icon} {j.category.name}
                  </p>
                  {j.disputeReason && <p className="mt-1 text-sm text-red-700">"{j.disputeReason}"</p>}
                </div>
                <Money xlm={j.priceXLM} className="text-sm" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
