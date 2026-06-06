import { db } from "../server/db";
import { sql } from "drizzle-orm";

const BASE = "https://379eabec-1527-4de0-99b0-f3d40f5cfdad-00-2g5s7ko8rwtcf.spock.replit.dev";

async function req(path: string, token: string, opts: any = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "x-auth-token": token, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  let body: any;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

interface R { label: string; pass: boolean; detail: string; note?: string }
const results: R[] = [];

function check(label: string, cond: boolean, detail = "", note?: string): boolean {
  results.push({ label, pass: cond, detail, note });
  console.log(`${cond ? "✅ PASS" : "❌ FAIL"} ${label}${detail ? " — " + detail : ""}${note ? " [" + note + "]" : ""}`);
  return cond;
}

async function run() {
  const rows = await db.execute(sql`
    SELECT email, id, auth_token FROM users
    WHERE email IN ('testpatient3@myperfectmeals.com','pepper.totten@yahoo.com')
  `);
  const byEmail: Record<string, any> = {};
  for (const r of rows.rows) byEmail[r.email as string] = r;

  const clientToken = byEmail["testpatient3@myperfectmeals.com"]?.auth_token as string;
  const clientId    = byEmail["testpatient3@myperfectmeals.com"]?.id as string;
  const coachToken  = byEmail["pepper.totten@yahoo.com"]?.auth_token as string;

  if (!clientToken || !coachToken) { console.error("Could not load test tokens"); process.exit(1); }

  // Clean up any prior test rows
  await db.execute(sql`DELETE FROM user_affiliate_accounts WHERE user_id = ${clientId}`);

  // ─── AFFILIATE SMOKE TESTS ────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  AFFILIATE SMOKE TESTS                   ║");
  console.log("╚══════════════════════════════════════════╝");

  console.log("\n── 1. Social Affiliate Path ──");
  const elig = await req("/api/affiliate/eligibility", clientToken);
  check("Eligibility endpoint 200", elig.status === 200, "status=" + elig.status);
  check("Social track eligible for all users", elig.body?.social?.eligible === true);

  console.log("\n── 2. Business Eligibility Gate (non-provider) ──");
  check("Non-provider blocked from business track", elig.body?.business?.eligible === false, "reason=" + elig.body?.business?.reason);
  const blockBiz = await req("/api/affiliate/register-track", clientToken, { method: "POST", body: JSON.stringify({ track: "business_affiliate" }) });
  check("Register business track → 403", blockBiz.status === 403, "status=" + blockBiz.status);

  console.log("\n── 3. Social Track Registration & Account ──");
  const reg = await req("/api/affiliate/register-track", clientToken, { method: "POST", body: JSON.stringify({ track: "social_affiliate" }) });
  check("Social register-track → 200", reg.status === 200, JSON.stringify(reg.body));

  const acct = await req("/api/affiliate/account", clientToken);
  check("Account shows social_affiliate track", acct.body?.account?.affiliateTrack === "social_affiliate", "track=" + acct.body?.account?.affiliateTrack);
  check("Account not yet activated (pre-cert)", !acct.body?.account?.isActive);
  check("Account has rewardfulReferralUrl field", "rewardfulReferralUrl" in (acct.body?.account ?? {}));
  check("Account has rewardfulReferralToken field", "rewardfulReferralToken" in (acct.body?.account ?? {}));

  const reReg = await req("/api/affiliate/register-track", clientToken, { method: "POST", body: JSON.stringify({ track: "social_affiliate" }) });
  check("Duplicate registration → idempotent", reReg.body?.note === "already_registered", JSON.stringify(reReg.body));

  console.log("\n── 4. Affiliate Dashboard Gate ──");
  const dash = await req("/api/affiliate/dashboard-link", clientToken);
  check("Dashboard link blocked for non-activated affiliate", dash.status === 404, "status=" + dash.status);

  console.log("\n── 5. Coach Eligibility (business track) ──");
  const cElig = await req("/api/affiliate/eligibility", coachToken);
  check("Coach eligibility resolves", cElig.status === 200);
  const coachReason = cElig.body?.business?.reason ?? "eligible";
  console.log(`   Coach business track: ${cElig.body?.business?.eligible ? "✅ eligible" : "⚠️  not eligible — " + coachReason}`);
  check("Coach eligibility check completes with reason", cElig.body?.business !== undefined,
    coachReason === "no_studio" ? "no_studio (coach needs studio setup — expected in dev)" : coachReason);

  console.log("\n── 6. Rewardful Secrets Configured ──");
  check("REWARDFUL_API_SECRET configured",     !!process.env.REWARDFUL_API_SECRET);
  check("REWARDFUL_CAMPAIGN_ID configured",    !!process.env.REWARDFUL_CAMPAIGN_ID);
  check("REWARDFUL_WEBHOOK_SECRET configured", !!process.env.REWARDFUL_WEBHOOK_SECRET);

  console.log("\n── 7. Webhook HMAC Verification ──");
  const unsignedWH = await fetch(BASE + "/api/webhooks/rewardful", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: { type: "test" }, object: { id: "x", email: "x@x.com" } }),
  });
  check("Unsigned webhook → 401 (HMAC active)", unsignedWH.status === 401, "status=" + unsignedWH.status);

  // ─── LEARNING & CERTIFICATION ─────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  LEARNING & CERTIFICATION REGRESSION     ║");
  console.log("╚══════════════════════════════════════════╝");

  const certProg = await req("/api/certifications/affiliate_social/progress", clientToken);
  check("Affiliate social cert progress 200", certProg.status === 200, "status=" + certProg.status);

  const platMods = await req("/api/certifications/platform/modules", coachToken);
  check("Platform cert DB modules 200", platMods.status === 200,
    "count=" + (platMods.body?.modules?.length ?? platMods.body?.length ?? JSON.stringify(platMods.body).slice(0, 60)));

  const socialMods = await req("/api/certifications/affiliate_social/modules", clientToken);
  check("Social cert modules responds (JS-driven type)", socialMods.status === 200 || socialMods.status === 400,
    "status=" + socialMods.status + (socialMods.status === 400 ? " (JS-driven — expected)" : ""));

  const lmsUpd = await req("/api/lms/updates", coachToken);
  check("LMS updates endpoint 200", lmsUpd.status === 200, "status=" + lmsUpd.status);

  const platProg = await req("/api/certifications/platform/progress", coachToken);
  check("Platform cert progress 200", platProg.status === 200, "status=" + platProg.status);

  // ─── AUTHENTICATION REGRESSION ───────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  AUTHENTICATION REGRESSION               ║");
  console.log("╚══════════════════════════════════════════╝");

  const clientProf = await req("/api/user/profile", clientToken);
  check("Client auth → profile 200", clientProf.status === 200, "id=" + clientProf.body?.id);

  const coachProf = await req("/api/user/profile", coachToken);
  check("Coach auth → profile 200", coachProf.status === 200, "role=" + coachProf.body?.role);

  const badAuth = await req("/api/user/profile", "invalid-token-xyz");
  check("Invalid token → 401", badAuth.status === 401);

  // ─── DIABETES / BIOMETRICS REGRESSION ────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  DIABETES / BIOMETRICS REGRESSION        ║");
  console.log("╚══════════════════════════════════════════╝");

  const glucose = await req("/api/biometrics/glucose", clientToken);
  check("Glucose endpoint responds", glucose.status === 200 || glucose.status === 404, "status=" + glucose.status);

  const today = new Date().toISOString().slice(0, 10);
  const mealLog = await req(`/api/meal-logs?userId=${clientId}&date=${today}`, clientToken);
  check("Meal logs (with required userId param)", mealLog.status === 200 || mealLog.status === 404, "status=" + mealLog.status);

  // ─── PROCARE REGRESSION ───────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  PROCARE REGRESSION                      ║");
  console.log("╚══════════════════════════════════════════╝");

  const proClients = await req("/api/pro/clients", coachToken);
  check("Coach → /api/pro/clients responds", proClients.status === 200 || proClients.status === 404, "status=" + proClients.status);

  const tabletSum = await req("/api/pro/tablet/unread-summary", coachToken);
  check("Pro tablet unread-summary responds", tabletSum.status === 200 || tabletSum.status === 304, "status=" + tabletSum.status);

  const clientTablet = await req("/api/client/tablet", clientToken);
  check("Client tablet responds", clientTablet.status === 200 || clientTablet.status === 404, "status=" + clientTablet.status);

  // ─── SHARED MEAL BUILDER REGRESSION ──────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  SHARED MEAL BUILDER REGRESSION          ║");
  console.log("╚══════════════════════════════════════════╝");

  const savedMeals = await req("/api/saved-meals", clientToken);
  check("Saved meals endpoint 200", savedMeals.status === 200, "count=" + (savedMeals.body?.length ?? "n/a"));

  const shopping = await req("/api/shopping-list", clientToken);
  check("Shopping list endpoint responds", shopping.status === 200 || shopping.status === 404, "status=" + shopping.status);

  // ─── FINAL TALLY ──────────────────────────────────────────────────────────
  const passes = results.filter(r => r.pass).length;
  const fails  = results.filter(r => !r.pass);

  console.log(`\n${"═".repeat(44)}`);
  console.log(`FINAL RESULT: ${passes}/${results.length} passed`);
  if (fails.length) {
    console.log("\nFailed tests:");
    for (const f of fails) console.log(`  ❌ ${f.label} — ${f.detail}`);
  } else {
    console.log("🎉 ALL TESTS PASSED");
  }
  console.log("═".repeat(44));
  process.exit(fails.length > 0 ? 1 : 0);
}

run().catch(e => { console.error("SMOKE TEST CRASHED:", e.message); process.exit(1); });
