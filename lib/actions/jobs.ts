"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendPayment, ensurePlatformAccount, getXlmBalance } from "@/lib/stellar";

function fail(jobId: string, message: string): never {
  redirect(`/jobs/${jobId}?error=${encodeURIComponent(message)}`);
}

function ok(jobId: string, message?: string): never {
  redirect(`/jobs/${jobId}${message ? `?ok=${encodeURIComponent(message)}` : ""}`);
}

export async function requestJob(formData: FormData) {
  const user = await requireUser();
  const providerProfileId = String(formData.get("providerProfileId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const priceXLM = Number(formData.get("priceXLM") ?? 0);

  const providerProfile = await db.query.providerProfiles.findFirst({
    where: eq(schema.providerProfiles.id, providerProfileId),
    with: { user: true }
  });

  if (!providerProfile) redirect(`/search?error=${encodeURIComponent("That artisan could not be found.")}`);
  if (!title || !description || !address || !(priceXLM > 0)) {
    redirect(
      `/providers/${providerProfile!.id}?error=${encodeURIComponent(
        "Please fill in a title, description, address, and a price above 0."
      )}`
    );
  }
  if (providerProfile!.userId === user.id) {
    redirect(`/providers/${providerProfile!.id}?error=${encodeURIComponent("You can't book yourself.")}`);
  }

  const [job] = await db
    .insert(schema.jobs)
    .values({
      customerId: user.id,
      providerId: providerProfile!.userId,
      providerProfileId: providerProfile!.id,
      categoryId: providerProfile!.categoryId,
      title,
      description,
      address,
      city: user.city ?? "Lagos",
      lat: user.lat,
      lng: user.lng,
      priceXLM,
      status: "REQUESTED"
    })
    .returning();

  revalidatePath("/dashboard");
  redirect(`/jobs/${job.id}?ok=${encodeURIComponent("Request sent! We'll notify the artisan.")}`);
}

async function loadJobForActor(jobId: string) {
  const user = await requireUser();
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
  if (!job) fail(jobId, "Job not found.");
  const isCustomer = job!.customerId === user.id;
  const isProvider = job!.providerId === user.id;
  const isAdmin = user.role === "ADMIN";
  return { user, job: job!, isCustomer, isProvider, isAdmin };
}

export async function acceptJob(jobId: string) {
  const { job, isProvider } = await loadJobForActor(jobId);
  if (!isProvider) fail(jobId, "Only the requested artisan can accept this job.");
  if (job.status !== "REQUESTED") fail(jobId, "This job can no longer be accepted.");
  await db.update(schema.jobs).set({ status: "ACCEPTED" }).where(eq(schema.jobs.id, jobId));
  revalidatePath(`/jobs/${jobId}`);
  ok(jobId, "Job accepted. Waiting for the customer to fund escrow.");
}

export async function cancelJob(jobId: string) {
  const { job, isCustomer, isProvider } = await loadJobForActor(jobId);
  if (!isCustomer && !isProvider) fail(jobId, "You're not part of this job.");
  if (!["REQUESTED", "ACCEPTED"].includes(job.status)) {
    fail(jobId, "This job has already progressed past cancellation — raise a dispute instead.");
  }
  await db.update(schema.jobs).set({ status: "CANCELLED" }).where(eq(schema.jobs.id, jobId));
  revalidatePath(`/jobs/${jobId}`);
  ok(jobId, "Job cancelled. No funds were moved.");
}

export async function fundEscrow(jobId: string) {
  const { job, isCustomer, user } = await loadJobForActor(jobId);
  if (!isCustomer) fail(jobId, "Only the customer can fund escrow.");
  if (job.status !== "ACCEPTED") fail(jobId, "This job isn't ready for escrow funding.");

  const [customerWallet] = await db
    .select()
    .from(schema.walletAccounts)
    .where(eq(schema.walletAccounts.userId, user.id));
  if (!customerWallet) fail(jobId, "Your wallet isn't set up yet.");

  const platform = await ensurePlatformAccount();

  const balance = await getXlmBalance(customerWallet.stellarPublicKey);
  if (balance < job.priceXLM + 2) {
    fail(
      jobId,
      `Your wallet balance (${balance.toFixed(2)} XLM) is too low to fund this ${job.priceXLM} XLM escrow plus network reserve. This is testnet play-money — visit /wallet to see your balance.`
    );
  }

  let hash: string;
  try {
    hash = await sendPayment({
      fromEncryptedSecret: customerWallet.encryptedSecret,
      toPublicKey: platform.publicKey,
      amountXLM: job.priceXLM,
      memo: `escrow:${jobId}`.slice(0, 28)
    });
  } catch (err) {
    console.error("[fundEscrow] payment failed", err);
    fail(jobId, "The Stellar payment failed. Please try again in a moment.");
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.jobs)
      .set({ status: "ESCROW_FUNDED", escrowTxHash: hash })
      .where(eq(schema.jobs.id, jobId));
    await tx.insert(schema.escrowEvents)
      .values({ jobId, type: "FUNDED", stellarTxHash: hash, amountXLM: job.priceXLM });
  });

  revalidatePath(`/jobs/${jobId}`);
  ok(jobId, "Escrow funded on Stellar. The artisan has been notified to start work.");
}

export async function startJob(jobId: string) {
  const { job, isProvider } = await loadJobForActor(jobId);
  if (!isProvider) fail(jobId, "Only the assigned artisan can start this job.");
  if (job.status !== "ESCROW_FUNDED") fail(jobId, "This job isn't ready to start.");
  await db.update(schema.jobs).set({ status: "IN_PROGRESS" }).where(eq(schema.jobs.id, jobId));
  revalidatePath(`/jobs/${jobId}`);
  ok(jobId, "Marked as in progress.");
}

export async function markComplete(jobId: string) {
  const { job, isProvider } = await loadJobForActor(jobId);
  if (!isProvider) fail(jobId, "Only the assigned artisan can mark this job complete.");
  if (!["ESCROW_FUNDED", "IN_PROGRESS"].includes(job.status)) {
    fail(jobId, "This job isn't in a state that can be marked complete.");
  }
  await db.update(schema.jobs).set({ status: "COMPLETED_BY_PROVIDER" }).where(eq(schema.jobs.id, jobId));
  revalidatePath(`/jobs/${jobId}`);
  ok(jobId, "Marked complete. Waiting for the customer to confirm and release payment.");
}

export async function confirmAndRelease(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const { job, isCustomer, user } = await loadJobForActor(jobId);
  if (!isCustomer) fail(jobId, "Only the customer can confirm and release payment.");
  if (job.status !== "COMPLETED_BY_PROVIDER") fail(jobId, "This job isn't awaiting confirmation.");

  const rating = Math.min(5, Math.max(1, Number(formData.get("rating") ?? 5)));
  const comment = String(formData.get("comment") ?? "").trim();

  const platform = await ensurePlatformAccount();
  const [providerWallet] = await db
    .select()
    .from(schema.walletAccounts)
    .where(eq(schema.walletAccounts.userId, job.providerId));
  if (!providerWallet) fail(jobId, "The artisan's wallet could not be found.");

  let hash: string;
  try {
    hash = await sendPayment({
      fromEncryptedSecret: platform.encryptedSecret,
      toPublicKey: providerWallet.stellarPublicKey,
      amountXLM: job.priceXLM,
      memo: `release:${jobId}`.slice(0, 28)
    });
  } catch (err) {
    console.error("[confirmAndRelease] payment failed", err);
    fail(jobId, "Releasing the on-chain payment failed. Please try again in a moment.");
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.jobs)
      .set({ status: "RELEASED", releaseTxHash: hash })
      .where(eq(schema.jobs.id, jobId));
    await tx.insert(schema.escrowEvents)
      .values({ jobId, type: "RELEASED", stellarTxHash: hash, amountXLM: job.priceXLM });
    await tx.insert(schema.reviews)
      .values({
        jobId,
        reviewerId: user.id,
        revieweeId: job.providerId,
        rating,
        comment: comment || "(no comment left)"
      });
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/providers/${job.providerProfileId}`);
  revalidatePath("/search");
  ok(jobId, "Payment released on-chain to the artisan. Thanks for the review!");
}

export async function raiseDispute(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const { job, isCustomer, isProvider, user } = await loadJobForActor(jobId);
  if (!isCustomer && !isProvider) fail(jobId, "You're not part of this job.");
  if (!["ESCROW_FUNDED", "IN_PROGRESS", "COMPLETED_BY_PROVIDER"].includes(job.status)) {
    fail(jobId, "A dispute can only be raised once escrow is funded.");
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) fail(jobId, "Please describe the issue in a bit more detail.");

  await db.transaction(async (tx) => {
    await tx.update(schema.jobs)
      .set({ status: "DISPUTED", disputeReason: reason, disputeRaisedBy: user.id })
      .where(eq(schema.jobs.id, jobId));
    await tx.insert(schema.escrowEvents)
      .values({ jobId, type: "DISPUTE_OPENED", amountXLM: job.priceXLM, note: reason });
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  ok(jobId, "Dispute raised. An admin will review and resolve it.");
}

export async function resolveDispute(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const decision = String(formData.get("decision") ?? ""); // "release" | "refund"
  const { job, isAdmin } = await loadJobForActor(jobId);
  if (!isAdmin) fail(jobId, "Only an admin can resolve disputes.");
  if (job.status !== "DISPUTED") fail(jobId, "This job isn't in dispute.");

  const platform = await ensurePlatformAccount();

  if (decision === "release") {
    const [providerWallet] = await db
      .select()
      .from(schema.walletAccounts)
      .where(eq(schema.walletAccounts.userId, job.providerId));
    if (!providerWallet) fail(jobId, "The artisan's wallet could not be found.");
    const hash = await sendPayment({
      fromEncryptedSecret: platform.encryptedSecret,
      toPublicKey: providerWallet.stellarPublicKey,
      amountXLM: job.priceXLM,
      memo: `resolve-rel:${jobId}`.slice(0, 28)
    });
    await db.transaction(async (tx) => {
      await tx.update(schema.jobs)
        .set({ status: "RELEASED", releaseTxHash: hash })
        .where(eq(schema.jobs.id, jobId));
      await tx.insert(schema.escrowEvents)
        .values({ jobId, type: "DISPUTE_RESOLVED_RELEASE", stellarTxHash: hash, amountXLM: job.priceXLM });
    });
  } else {
    const [customerWallet] = await db
      .select()
      .from(schema.walletAccounts)
      .where(eq(schema.walletAccounts.userId, job.customerId));
    if (!customerWallet) fail(jobId, "The customer's wallet could not be found.");
    const hash = await sendPayment({
      fromEncryptedSecret: platform.encryptedSecret,
      toPublicKey: customerWallet.stellarPublicKey,
      amountXLM: job.priceXLM,
      memo: `resolve-ref:${jobId}`.slice(0, 28)
    });
    await db.transaction(async (tx) => {
      await tx.update(schema.jobs)
        .set({ status: "REFUNDED", refundTxHash: hash })
        .where(eq(schema.jobs.id, jobId));
      await tx.insert(schema.escrowEvents)
        .values({ jobId, type: "DISPUTE_RESOLVED_REFUND", stellarTxHash: hash, amountXLM: job.priceXLM });
    });
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/disputes");
  ok(jobId, "Dispute resolved and funds moved on-chain.");
}
