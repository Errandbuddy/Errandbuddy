import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  acceptJob,
  cancelJob,
  fundEscrow,
  startJob,
  markComplete,
  confirmAndRelease,
  raiseDispute,
  resolveDispute
} from "@/lib/actions/jobs";
import { explorerTxUrl, isMockMode } from "@/lib/stellar";
import Flash from "@/components/Flash";
import StatusPill from "@/components/StatusPill";
import Money from "@/components/Money";

const EVENT_LABELS: Record<string, string> = {
  FUNDED: "Escrow funded",
  RELEASED: "Payment released to artisan",
  REFUNDED: "Refunded to customer",
  DISPUTE_OPENED: "Dispute opened",
  DISPUTE_RESOLVED_RELEASE: "Dispute resolved — released to artisan",
  DISPUTE_RESOLVED_REFUND: "Dispute resolved — refunded to customer"
};

export default async function JobDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?error=${encodeURIComponent("Please log in to view this job.")}`);

  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, params.id),
    with: { customer: true, provider: true, providerProfile: true, category: true, review: true }
  });
  if (!job) notFound();

  const isCustomer = job.customerId === user.id;
  const isProvider = job.providerId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isCustomer && !isProvider && !isAdmin) redirect("/dashboard");

  const events = await db.query.escrowEvents.findMany({
    where: eq(schema.escrowEvents.jobId, job.id),
    orderBy: asc(schema.escrowEvents.createdAt)
  });

  const counterparty = isCustomer ? job.provider : job.customer;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/40">
            {job.category.icon} {job.category.name}
          </p>
          <h1 className="text-2xl font-bold">{job.title}</h1>
        </div>
        <StatusPill status={job.status} />
      </div>

      <Flash ok={searchParams.ok} error={searchParams.error} />

      <div className="card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label !mb-1">
              {isCustomer ? "Artisan" : "Customer"}
            </p>
            <p className="text-sm">{counterparty.name}</p>
          </div>
          <div>
            <p className="label !mb-1">Price</p>
            <Money xlm={job.priceXLM} className="text-sm" />
          </div>
          <div>
            <p className="label !mb-1">Address</p>
            <p className="text-sm">{job.address}, {job.city}</p>
          </div>
          <div>
            <p className="label !mb-1">Requested</p>
            <p className="text-sm">{new Date(job.createdAt).toLocaleString("en-NG")}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="label !mb-1">Description</p>
          <p className="whitespace-pre-line text-sm text-ink/70">{job.description}</p>
        </div>
        {job.status === "DISPUTED" && job.disputeReason && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <strong>Dispute reason:</strong> {job.disputeReason}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card mt-6 p-6">
        <h2 className="mb-4 font-semibold">Actions</h2>
        <JobActions
          job={job}
          isCustomer={isCustomer}
          isProvider={isProvider}
          isAdmin={isAdmin}
        />
      </div>

      {/* Escrow timeline */}
      <div className="card mt-6 p-6">
        <h2 className="mb-4 font-semibold">On-chain escrow trail</h2>
        {isMockMode() && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Running in simulated-ledger mode (STELLAR_MODE=mock) — amounts move exactly as they would
            on Stellar testnet, but transaction hashes here aren't real and won't resolve on an
            explorer. Set STELLAR_MODE=live to use real Stellar testnet.
          </p>
        )}
        {events.length === 0 ? (
          <p className="text-sm text-ink/50">No on-chain activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => {
              const url = e.stellarTxHash ? explorerTxUrl(e.stellarTxHash) : null;
              return (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</p>
                    <p className="text-xs text-ink/50">{new Date(e.createdAt).toLocaleString("en-NG")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{e.amountXLM} XLM</p>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
                        View on Stellar Expert
                      </a>
                    ) : (
                      <span className="text-xs text-ink/40">simulated</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {job.review && (
        <div className="card mt-6 p-6">
          <h2 className="mb-2 font-semibold">Your review</h2>
          <p className="text-sm text-ink/70">
            {"★".repeat(job.review.rating)}
            {"☆".repeat(5 - job.review.rating)} — {job.review.comment}
          </p>
        </div>
      )}
    </div>
  );
}

function JobActions({
  job,
  isCustomer,
  isProvider,
  isAdmin
}: {
  job: typeof schema.jobs.$inferSelect;
  isCustomer: boolean;
  isProvider: boolean;
  isAdmin: boolean;
}) {
  const buttons: React.ReactNode[] = [];

  if (job.status === "REQUESTED") {
    if (isProvider) {
      buttons.push(
        <form key="accept" action={acceptJob.bind(null, job.id)}>
          <button type="submit" className="btn-primary">Accept job</button>
        </form>
      );
    }
    if (isCustomer || isProvider) {
      buttons.push(
        <form key="cancel" action={cancelJob.bind(null, job.id)}>
          <button type="submit" className="btn-secondary">
            {isProvider ? "Decline" : "Cancel request"}
          </button>
        </form>
      );
    }
  }

  if (job.status === "ACCEPTED") {
    if (isCustomer) {
      buttons.push(
        <form key="fund" action={fundEscrow.bind(null, job.id)}>
          <button type="submit" className="btn-primary">Fund escrow &amp; confirm booking</button>
        </form>
      );
      buttons.push(
        <form key="cancel" action={cancelJob.bind(null, job.id)}>
          <button type="submit" className="btn-secondary">Cancel</button>
        </form>
      );
    } else if (isProvider) {
      buttons.push(<p key="wait" className="text-sm text-ink/50">Waiting for the customer to fund escrow.</p>);
    }
  }

  if (job.status === "ESCROW_FUNDED" || job.status === "IN_PROGRESS") {
    if (isProvider) {
      if (job.status === "ESCROW_FUNDED") {
        buttons.push(
          <form key="start" action={startJob.bind(null, job.id)}>
            <button type="submit" className="btn-secondary">Mark as started</button>
          </form>
        );
      }
      buttons.push(
        <form key="complete" action={markComplete.bind(null, job.id)}>
          <button type="submit" className="btn-primary">Mark job complete</button>
        </form>
      );
    }
    if (isCustomer) {
      buttons.push(
        <p key="wait" className="text-sm text-ink/50">
          Escrow is funded and safe. Waiting for the artisan to finish the job.
        </p>
      );
    }
    if (isCustomer || isProvider) {
      buttons.push(<DisputeForm key="dispute" jobId={job.id} />);
    }
  }

  if (job.status === "COMPLETED_BY_PROVIDER") {
    if (isCustomer) {
      buttons.push(
        <form key="confirm" action={confirmAndRelease} className="w-full space-y-3 rounded-lg border border-ink/10 p-4">
          <input type="hidden" name="jobId" value={job.id} />
          <p className="text-sm font-medium">Confirm the job is done and release payment</p>
          <div>
            <label className="label">Rate this artisan</label>
            <select name="rating" className="input" defaultValue="5">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{"★".repeat(n)} ({n}/5)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Leave a review</label>
            <textarea name="comment" className="input" placeholder="How did it go?" />
          </div>
          <button type="submit" className="btn-primary w-full">Confirm &amp; release payment on-chain</button>
        </form>
      );
      buttons.push(<DisputeForm key="dispute" jobId={job.id} />);
    } else if (isProvider) {
      buttons.push(<p key="wait" className="text-sm text-ink/50">Waiting for the customer to confirm and release payment.</p>);
    }
  }

  if (job.status === "DISPUTED") {
    if (isAdmin) {
      buttons.push(
        <div key="resolve" className="flex flex-wrap gap-3">
          <form action={resolveDispute}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="decision" value="release" />
            <button type="submit" className="btn-primary">Resolve: release to artisan</button>
          </form>
          <form action={resolveDispute}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="decision" value="refund" />
            <button type="submit" className="btn-danger">Resolve: refund customer</button>
          </form>
        </div>
      );
    } else {
      buttons.push(<p key="wait" className="text-sm text-ink/50">An admin is reviewing this dispute.</p>);
    }
  }

  if (["RELEASED", "REFUNDED", "CANCELLED"].includes(job.status)) {
    buttons.push(<p key="done" className="text-sm text-ink/50">This job is closed. No further action needed.</p>);
  }

  if (buttons.length === 0) {
    buttons.push(<p key="none" className="text-sm text-ink/50">No actions available right now.</p>);
  }

  return <div className="flex flex-wrap items-start gap-3">{buttons}</div>;
}

function DisputeForm({ jobId }: { jobId: string }) {
  return (
    <details className="w-full rounded-lg border border-ink/10 p-3">
      <summary className="cursor-pointer text-sm font-medium text-red-700">Raise a dispute</summary>
      <form action={raiseDispute} className="mt-3 space-y-2">
        <input type="hidden" name="jobId" value={jobId} />
        <textarea name="reason" className="input" required placeholder="What went wrong?" />
        <button type="submit" className="btn-danger">Submit dispute</button>
      </form>
    </details>
  );
}
