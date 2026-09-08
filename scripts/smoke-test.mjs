// Standalone Playwright smoke test — NOT part of the shipped app, just used
// to verify the core flows end-to-end during development. Run with:
//   npm run build && npm run start &
//   node scripts/smoke-test.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];

function check(name, condition, extra = "") {
  results.push({ name, pass: !!condition, extra });
  console.log(`${condition ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!condition) throw new Error(`FAILED: ${name} ${extra}`);
}

/** Clicks a button that submits a Next.js Server Action and waits for both
 * the resulting request AND the client-side RSC swap to settle. Server
 * Actions update the URL bar (via an `x-action-redirect` response header)
 * slightly before the new page content finishes rendering, so waiting on
 * the URL alone can read stale DOM — waiting on the POST response first
 * avoids that race. */
async function clickAndWait(page, locator) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), locator.click()]);
  await page.waitForLoadState("networkidle");
}

async function main() {
  const browser = await chromium.launch();

  // ---- Customer signs up ----
  const customerCtx = await browser.newContext();
  const customerPage = await customerCtx.newPage();
  const customerEmail = `test-customer-${Date.now()}@example.com`;

  await customerPage.goto(`${BASE}/signup`);
  await customerPage.getByLabel("Full name").fill("Test Customer");
  await customerPage.getByLabel("Email").fill(customerEmail);
  await customerPage.getByLabel("Password").fill("testpass123");
  await clickAndWait(customerPage, customerPage.getByRole("button", { name: "Create account" }));
  check("customer signup redirects to /search", customerPage.url().includes("/search"));

  // ---- Browse and open a seeded provider ----
  await customerPage.goto(`${BASE}/search?category=plumbing`);
  const firstCard = customerPage.locator('a[href^="/providers/"]').first();
  check("search shows at least one plumbing provider", (await firstCard.count()) > 0);
  const providerHref = await firstCard.getAttribute("href");
  await customerPage.goto(`${BASE}${providerHref}`);
  check("provider profile loaded", ((await customerPage.textContent("h1")) ?? "").length > 0);

  // ---- Request a job ----
  await customerPage.getByLabel("What do you need done?").fill("Fix leaking kitchen tap");
  await customerPage.getByLabel("Details").fill("Tap in the kitchen has been dripping for a week.");
  await customerPage.getByLabel("Address").fill("12 Test Street, Yaba");
  await customerPage.getByLabel("Agreed price (XLM)").fill("20");
  await clickAndWait(customerPage, customerPage.getByRole("button", { name: "Send request" }));
  const jobUrl = customerPage.url().split("?")[0];
  check("job request created", jobUrl.includes("/jobs/"));
  check("job status is Requested", (await customerPage.textContent("body")).includes("Requested"));

  // ---- Provider logs in and accepts ----
  const providerCtx = await browser.newContext();
  const providerPage = await providerCtx.newPage();
  await providerPage.goto(`${BASE}/login`);
  await providerPage.getByLabel("Email").fill("chuka.plumber@demo.errandbuddy");
  await providerPage.getByLabel("Password").fill("demo1234");
  await providerPage.getByRole("button", { name: "Log in" }).click();
  await providerPage.waitForURL(/\/dashboard/, { timeout: 15000 });
  check("provider login works", providerPage.url().includes("/dashboard"));

  await providerPage.goto(jobUrl);
  const acceptBtn = providerPage.getByRole("button", { name: "Accept job" });
  check("job was assigned to chuka.plumber (accept button present)", (await acceptBtn.count()) > 0);
  await clickAndWait(providerPage, acceptBtn);
  check("provider accepted job", (await providerPage.textContent("body")).includes("Accepted"));

  // ---- Customer funds escrow ----
  await customerPage.goto(jobUrl);
  await clickAndWait(customerPage, customerPage.getByRole("button", { name: /Fund escrow/ }));
  const fundedBody = await customerPage.textContent("body");
  check("escrow funded", fundedBody.includes("Escrow funded") || fundedBody.includes("funded on Stellar"));

  // ---- Provider marks complete ----
  await providerPage.goto(jobUrl);
  await clickAndWait(providerPage, providerPage.getByRole("button", { name: "Mark job complete" }));
  check("provider marked complete", (await providerPage.textContent("body")).includes("Awaiting your confirmation"));

  // ---- Customer confirms and releases ----
  await customerPage.goto(jobUrl);
  await clickAndWait(customerPage, customerPage.getByRole("button", { name: /Confirm & release/ }));
  const releasedBody = await customerPage.textContent("body");
  check("payment released", releasedBody.includes("Paid & closed"));

  // ---- Wallet balance renders for both ----
  await customerPage.goto(`${BASE}/wallet`);
  check("customer wallet page renders a balance", /XLM/.test(await customerPage.textContent("body")));
  await providerPage.goto(`${BASE}/wallet`);
  check("provider wallet page renders a balance", /XLM/.test(await providerPage.textContent("body")));

  // ---- Dispute + admin resolution flow, on a second job ----
  await customerPage.goto(`${BASE}${providerHref}`);
  await customerPage.getByLabel("What do you need done?").fill("Second job for dispute test");
  await customerPage.getByLabel("Details").fill("Testing the dispute path end to end.");
  await customerPage.getByLabel("Address").fill("1 Dispute Ave");
  await customerPage.getByLabel("Agreed price (XLM)").fill("15");
  await clickAndWait(customerPage, customerPage.getByRole("button", { name: "Send request" }));
  const disputeJobUrl = customerPage.url().split("?")[0];

  await providerPage.goto(disputeJobUrl);
  await clickAndWait(providerPage, providerPage.getByRole("button", { name: "Accept job" }));

  await customerPage.goto(disputeJobUrl);
  await clickAndWait(customerPage, customerPage.getByRole("button", { name: /Fund escrow/ }));

  await customerPage.getByText("Raise a dispute").waitFor({ state: "visible", timeout: 10000 });
  await customerPage.getByText("Raise a dispute").click();
  await customerPage.locator('textarea[name="reason"]').waitFor({ state: "visible", timeout: 5000 });
  await customerPage.locator('textarea[name="reason"]').fill("Artisan never showed up.");
  await clickAndWait(customerPage, customerPage.getByRole("button", { name: "Submit dispute" }));

  // The server action itself is confirmed synchronous with its DB write (see
  // lib/actions/jobs.ts), but occasionally the client-side RSC swap the
  // redirect triggers hasn't fully replaced the DOM by the time networkidle
  // fires. A plain reload re-fetches the authoritative server state, so
  // retry via reload (never by resubmitting the form) if the first read
  // looks stale.
  let disputeRaised = (await customerPage.textContent("body")).includes("In dispute");
  for (let attempt = 1; attempt <= 3 && !disputeRaised; attempt++) {
    console.log(`  (dispute status not visible yet, reloading — attempt ${attempt})`);
    await customerPage.goto(disputeJobUrl);
    disputeRaised = (await customerPage.textContent("body")).includes("In dispute");
  }
  check("dispute raised", disputeRaised);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto(`${BASE}/login`);
  await adminPage.getByLabel("Email").fill("admin@demo.errandbuddy");
  await adminPage.getByLabel("Password").fill("demo1234");
  await adminPage.getByRole("button", { name: "Log in" }).click();
  await adminPage.waitForURL(/\/dashboard/, { timeout: 15000 });

  await adminPage.goto(`${BASE}/admin/disputes`);
  check("admin sees the dispute", (await adminPage.textContent("body")).includes("Second job for dispute test"));

  await adminPage.goto(disputeJobUrl);
  await clickAndWait(adminPage, adminPage.getByRole("button", { name: "Resolve: refund customer" }));
  check("dispute resolved as refund", (await adminPage.textContent("body")).includes("Refunded"));

  await browser.close();

  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err.message);
  process.exit(1);
});
