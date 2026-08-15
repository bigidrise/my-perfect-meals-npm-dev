/**
 * ProCare Invitation Link — end-to-end smoke test (four real-account scenarios)
 *
 * Covers the four scenarios before the first live use of the token-based flow:
 *
 *  1. Existing MPM user + correct invited email  → membership created, invite marked accepted
 *  2. Brand-new / unauthenticated user           → public GET returns valid preview (no raw email)
 *  3. Wrong email account                        → EMAIL_MISMATCH with masked address
 *  4. Expired / already-accepted invite          → EXPIRED / ALREADY_ACCEPTED
 *
 * Also exercises the HTTP routes via supertest:
 *  - GET  /api/procare-invite/token/:token  — 404 for unknown, 200 for valid; invitedEmail absent
 *  - POST /api/procare-invite/token/:token/accept — 401 when unauthenticated
 *
 * Run: npx tsx server/services/__tests__/procareInviteFlow.test.ts
 *
 * Cleanup: every DB row inserted is deleted in finally, in dependency order.
 * The run exits nonzero when cleanup fails.
 */

import express from "express";
import supertest from "supertest";
import { db } from "../../db";
import { careInvite } from "../../db/schema/careTeam";
import { studios } from "../../db/schema/studio";
import { clientLinks } from "../../db/schema/procare";
import { userDocumentAcceptance } from "../../db/schema/legal";
import { users } from "../../../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import procareInviteRouter from "../../routes/procareInviteRoutes";
import {
  resolveInviteByToken,
  getInviteMetadata,
  acceptInviteByToken,
} from "../procareInviteService";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ FAIL: ${label}`;
    console.log(msg);
    failMessages.push(msg);
  }
}

function eq_(a: unknown, b: unknown, label: string) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) {
    console.log(`     expected: ${JSON.stringify(b)}`);
    console.log(`     received: ${JSON.stringify(a)}`);
  }
  assert(ok, label);
}

function section(title: string) {
  console.log(`\n${"─".repeat(66)}`);
  console.log(`▶ ${title}`);
  console.log("─".repeat(66));
}

// ─────────────────────────────────────────────────────────────────────────────
// Supertest HTTP app — mounts only the procare-invite router.
// requireAuth reads req.session?.userId or x-auth-token header; neither is
// provided in the unauthenticated POST tests, so it returns 401 as expected.
// ─────────────────────────────────────────────────────────────────────────────

const httpApp = express();
httpApp.use(express.json());
httpApp.use("/api/procare-invite", procareInviteRouter);
const agent = supertest(httpApp);

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup registry — populated during setup, flushed in finally.
// Dependency order matters: client_links and legal docs before users, studios
// before users (cascade deletes memberships), invites last to avoid FK gaps.
// ─────────────────────────────────────────────────────────────────────────────

let cleanupClientUserId: string | null = null;
let cleanupProUserId: string | null = null;
let cleanupOtherUserId: string | null = null;
let cleanupStudioId: string | null = null;
const cleanupInviteIds: string[] = [];
// Extra users created mid-test (e.g. short-email pro user)
const cleanupUserIds_extra: string[] = [];

async function cleanup(): Promise<void> {
  const errors: string[] = [];

  async function step(label: string, fn: () => Promise<void>) {
    try { await fn(); }
    catch (err: any) { errors.push(`${label}: ${err.message}`); }
  }

  // 1. client_links — no FK cascade from users, must delete explicitly
  if (cleanupClientUserId) {
    await step("client_links(client)", () =>
      db.delete(clientLinks).where(eq(clientLinks.clientUserId, cleanupClientUserId!)).then(() => {}));
  }
  if (cleanupProUserId) {
    await step("client_links(pro)", () =>
      db.delete(clientLinks).where(eq(clientLinks.proUserId, cleanupProUserId!)).then(() => {}));
  }

  // 2. Legal acceptance docs
  for (const uid of [cleanupClientUserId, cleanupProUserId, cleanupOtherUserId]) {
    if (uid) {
      await step(`userDocumentAcceptance(${uid.slice(0, 8)})`, () =>
        db.delete(userDocumentAcceptance).where(eq(userDocumentAcceptance.userId, uid)).then(() => {}));
    }
  }

  // 3. Invite rows
  if (cleanupInviteIds.length) {
    await step("careInvite rows", () =>
      db.delete(careInvite).where(inArray(careInvite.id, cleanupInviteIds)).then(() => {}));
  }

  // 4. Studio — cascades to studioMemberships, clientSubscriptions, etc.
  if (cleanupStudioId) {
    await step("studio", () =>
      db.delete(studios).where(eq(studios.id, cleanupStudioId!)).then(() => {}));
  }

  // 5. Users (main fixtures + any mid-test extras)
  const userIds = [
    cleanupClientUserId, cleanupProUserId, cleanupOtherUserId,
    ...cleanupUserIds_extra,
  ].filter(Boolean) as string[];
  if (userIds.length) {
    await step("users", () =>
      db.delete(users).where(inArray(users.id, userIds)).then(() => {}));
  }

  if (errors.length) {
    console.error("\n⚠️  Cleanup errors (test run will exit 1):");
    errors.forEach(e => console.error(`  • ${e}`));
    // Propagate — caller (finally block) sets exitCode
    throw new Error(`Cleanup failed: ${errors.join("; ")}`);
  } else {
    console.log("\n🧹 Cleanup complete");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

const RUN = Date.now();
const PRO_EMAIL    = `procare-pro-${RUN}@test.invalid`;
const CLIENT_EMAIL = `procare-client-${RUN}@test.invalid`;
const OTHER_EMAIL  = `procare-other-${RUN}@test.invalid`;
// Two-character local part — maskEmail must not expose this verbatim
const SHORT_EMAIL  = `ab@test-${RUN}.invalid`;
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 24 * 60 * 60 * 1000);

async function seedUser(
  email: string,
  planLookupKey?: string,
  professionalRole?: string,
  authToken?: string,
): Promise<string> {
  const username = email.replace(/@.*$/, "").replace(/[^a-z0-9]/g, "_");
  const [row] = await db
    .insert(users)
    .values({
      username, email, password: "hashed_placeholder",
      planLookupKey: planLookupKey ?? null,
      professionalRole: (professionalRole as any) ?? null,
      authToken: authToken ?? null,
    } as any)
    .returning({ id: users.id });
  return row.id as string;
}

async function seedStudio(proUserId: string, name: string): Promise<string> {
  const [row] = await db
    .insert(studios)
    .values({ ownerUserId: proUserId, name, type: "studio" } as any)
    .returning({ id: studios.id });
  return row.id as string;
}

async function seedInvite(proUserId: string, email: string, expiresAt: Date, accepted = false): Promise<{ inviteId: string; urlToken: string }> {
  const urlToken = `test-token-${randomUUID()}`;
  const [row] = await db
    .insert(careInvite)
    .values({
      userId: proUserId, email, role: "client",
      permissions: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
      inviteCode: `MP-TEST-${RUN}`, urlToken, expiresAt, accepted,
    } as any)
    .returning({ id: careInvite.id });
  const inviteId = row.id as string;
  cleanupInviteIds.push(inviteId);
  return { inviteId, urlToken };
}

// Keep in sync with shared/legalDocuments.ts LEGAL_DOCUMENTS.client
const CLIENT_LEGAL_DOCS = [
  "client_coaching_agreement",
  "client_liability_waiver",
  "client_data_consent",
  "nutrition_disclaimer",
];

async function seedLegalDocs(userId: string): Promise<void> {
  for (const documentType of CLIENT_LEGAL_DOCS) {
    await db
      .insert(userDocumentAcceptance)
      .values({ userId, documentType, version: 1 } as any)
      .returning({ id: (userDocumentAcceptance as any).id });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test body
// ─────────────────────────────────────────────────────────────────────────────

let exitCode = 0;

try {

  // ── Setup ──────────────────────────────────────────────────────────────────

  // Auth token for the client — lets requireAuth authenticate x-auth-token requests
  const CLIENT_AUTH_TOKEN = `test-auth-${randomUUID()}`;

  section("Setup — seeding shared fixtures");
  {
    cleanupProUserId    = await seedUser(PRO_EMAIL, "mpm_procare_monthly", "trainer");
    // Client needs planLookupKey=mpm_ultimate_monthly so requireAuth resolves PAID_FULL
    cleanupClientUserId = await seedUser(CLIENT_EMAIL, "mpm_ultimate_monthly", undefined, CLIENT_AUTH_TOKEN);
    cleanupOtherUserId  = await seedUser(OTHER_EMAIL);
    cleanupStudioId     = await seedStudio(cleanupProUserId, `Test Studio ${RUN}`);
    await seedLegalDocs(cleanupClientUserId);

    assert(!!cleanupProUserId,    `Pro user seeded (${cleanupProUserId})`);
    assert(!!cleanupClientUserId, `Client user seeded (${cleanupClientUserId})`);
    assert(!!cleanupOtherUserId,  `Other-email user seeded (${cleanupOtherUserId})`);
    assert(!!cleanupStudioId,     `Studio seeded (${cleanupStudioId})`);

    // Verify legal docs are readable before we rely on them in Scenario 1
    const storedDocs = await db
      .select({ documentType: userDocumentAcceptance.documentType })
      .from(userDocumentAcceptance)
      .where(eq(userDocumentAcceptance.userId, cleanupClientUserId));
    assert(storedDocs.length === CLIENT_LEGAL_DOCS.length,
      `All ${CLIENT_LEGAL_DOCS.length} legal docs seeded (got ${storedDocs.length})`);
  }

  // ── HTTP: GET route — public ───────────────────────────────────────────────

  section("HTTP GET — public invite metadata endpoint");
  {
    // 404 for unknown token
    const res404 = await agent
      .get("/api/procare-invite/token/totally-unknown-token-xyz")
      .expect(404);
    assert(typeof res404.body.error === "string", "404 body has error string for unknown token");

    // Seed a live invite and probe the 200 response shape
    const { urlToken: liveToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE);
    const res200 = await agent
      .get(`/api/procare-invite/token/${encodeURIComponent(liveToken)}`)
      .expect(200);

    const body = res200.body;
    assert(typeof body.studioName === "string" && body.studioName.length > 0,
      `studioName present: "${body.studioName}"`);
    assert(typeof body.maskedEmail === "string" && body.maskedEmail.includes("@"),
      `maskedEmail present: "${body.maskedEmail}"`);
    assert(!("invitedEmail" in body),
      "invitedEmail is NOT exposed by the public endpoint (privacy guard)");
    assert(body.expired === false,  "expired=false for future invite");
    assert(body.alreadyAccepted === false, "alreadyAccepted=false for fresh invite");
    assert(typeof body.studioType === "string", `studioType present: "${body.studioType}"`);

    // Expired invite → 200 with expired=true
    const { urlToken: expiredToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, PAST);
    const resExpired = await agent
      .get(`/api/procare-invite/token/${encodeURIComponent(expiredToken)}`)
      .expect(200);
    assert(resExpired.body.expired === true, "expired invite → metadata.expired=true");

    // Already-accepted invite → 200 with alreadyAccepted=true
    const { urlToken: acceptedToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE, true);
    const resAccepted = await agent
      .get(`/api/procare-invite/token/${encodeURIComponent(acceptedToken)}`)
      .expect(200);
    assert(resAccepted.body.alreadyAccepted === true, "accepted invite → metadata.alreadyAccepted=true");
  }

  // ── HTTP: GET — short local-part email privacy ────────────────────────────

  section("HTTP GET — short local-part email: raw address never exposed");
  {
    // Seed a second pro user so we can create an invite for SHORT_EMAIL without
    // conflicting with the main pro studio (ownerUserId must be unique on studios).
    const shortProId = await seedUser(`short-pro-${RUN}@test.invalid`, "mpm_procare_monthly", "trainer");
    cleanupUserIds_extra.push(shortProId);

    const { urlToken: shortToken } = await seedInvite(shortProId, SHORT_EMAIL, FUTURE);
    const resShort = await agent
      .get(`/api/procare-invite/token/${encodeURIComponent(shortToken)}`)
      .expect(200);

    const body = resShort.body;
    // The full short-email address (both local part and full string) must not
    // appear anywhere in the serialised response.
    const serialised = JSON.stringify(body);
    assert(!serialised.includes(SHORT_EMAIL),
      `Full SHORT_EMAIL (${SHORT_EMAIL}) absent from response body`);
    assert(!serialised.includes("ab@"),
      `Short local "ab@" not exposed in any response field`);
    assert(typeof body.maskedEmail === "string" && body.maskedEmail.includes("@"),
      `maskedEmail still present and valid: "${body.maskedEmail}"`);
    assert(!body.maskedEmail.startsWith("ab"),
      `maskedEmail does not start with the short local part "ab"`);
  }

  // ── HTTP: POST route — auth enforcement ────────────────────────────────────

  section("HTTP POST — auth middleware enforced (no session → 401)");
  {
    const { urlToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE);
    const res = await agent
      .post(`/api/procare-invite/token/${encodeURIComponent(urlToken)}/accept`)
      .send({})
      .expect(401);
    assert(res.status === 401, "POST without auth returns 401 (requireAuth is active on this route)");
  }

  // ── HTTP: POST route — authenticated success path ─────────────────────────

  section("HTTP POST — authenticated success path (x-auth-token, full HTTP round-trip)");
  {
    // Seed a fresh invite so it hasn't been consumed by Scenario 1
    const { urlToken: httpToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE);

    // Activate via HTTP — requireAuth reads x-auth-token from the users table,
    // then resolves planLookupKey=mpm_ultimate_monthly → PAID_FULL.
    const res = await agent
      .post(`/api/procare-invite/token/${encodeURIComponent(httpToken)}/accept`)
      .set("x-auth-token", CLIENT_AUTH_TOKEN)
      .send({})
      .expect(200);

    assert(res.status === 200, "HTTP 200 on authenticated accept");
    assert(res.body.success === true, "response body has success:true");
    assert(typeof res.body.membership?.membershipId === "string",
      `membership.membershipId returned: ${res.body.membership?.membershipId}`);
    assert(typeof res.body.membership?.studioName === "string",
      `membership.studioName returned: "${res.body.membership?.studioName}"`);
    console.log(`    → HTTP success: membershipId=${res.body.membership?.membershipId}`);
  }

  // ── Scenario 2 — Brand-new user: public metadata survives pre-auth ─────────

  section("Scenario 2 — Brand-new user: service returns valid preview metadata");
  {
    const { urlToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE);
    const metadata = await getInviteMetadata(urlToken);

    assert(metadata !== null, "getInviteMetadata resolves a valid row");
    assert(metadata?.expired === false, "invite is not yet expired");
    assert(metadata?.alreadyAccepted === false, "invite is not yet accepted");
    assert(typeof metadata?.studioName === "string" && metadata.studioName.length > 0,
      `studioName: "${metadata?.studioName}"`);
    assert(typeof metadata?.proName === "string" && metadata.proName.length > 0,
      `proName: "${metadata?.proName}"`);
    assert(typeof metadata?.maskedEmail === "string" && metadata.maskedEmail.includes("@"),
      `maskedEmail: "${metadata?.maskedEmail}"`);
    assert(metadata?.maskedEmail !== metadata?.invitedEmail,
      "maskedEmail differs from raw invitedEmail in service layer");

    console.log(`    → Preview: "${metadata?.proName}" → "${metadata?.studioName}"`);
    console.log(`    → After login, redirected to /join/studio?token=${urlToken.slice(0, 16)}…`);
  }

  // ── Scenario 3 — Wrong email: EMAIL_MISMATCH ──────────────────────────────

  section("Scenario 3 — Wrong email: EMAIL_MISMATCH with masked invited address");
  {
    const { urlToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE);
    const result = await acceptInviteByToken(urlToken, cleanupOtherUserId!, "mpm_ultimate_monthly", "PAID_FULL");

    assert(result.ok === false, "acceptance rejected for wrong email");
    if (!result.ok) {
      eq_(result.error.code, "EMAIL_MISMATCH", "error code is EMAIL_MISMATCH");
      const masked = (result.error as any).maskedEmail as string;
      assert(typeof masked === "string" && masked.includes("@"), `maskedEmail returned: "${masked}"`);
      assert(!masked.includes(CLIENT_EMAIL.split("@")[0].slice(1, -1)),
        "maskedEmail does not expose the full local part");
      console.log(`    → User told to use: "${masked}"`);
    }
  }

  // ── Scenario 4a — Expired invite ──────────────────────────────────────────

  section("Scenario 4a — Expired invite: EXPIRED error code");
  {
    const { urlToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, PAST);

    const metadata = await getInviteMetadata(urlToken);
    assert(metadata?.expired === true, "metadata.expired is true");

    const result = await acceptInviteByToken(urlToken, cleanupClientUserId!, "mpm_ultimate_monthly", "PAID_FULL");
    assert(result.ok === false, "acceptance rejected");
    if (!result.ok) eq_(result.error.code, "EXPIRED", "error code is EXPIRED");

    console.log(`    → User sees "Invitation Expired" screen`);
  }

  // ── Scenario 4b — Already-accepted invite ─────────────────────────────────

  section("Scenario 4b — Already-accepted invite: ALREADY_ACCEPTED error code");
  {
    const { urlToken } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE, true);

    const metadata = await getInviteMetadata(urlToken);
    assert(metadata?.alreadyAccepted === true, "metadata.alreadyAccepted is true");
    assert(metadata?.expired === false, "metadata.expired is false (still in-window)");

    const result = await acceptInviteByToken(urlToken, cleanupClientUserId!, "mpm_ultimate_monthly", "PAID_FULL");
    assert(result.ok === false, "acceptance rejected");
    if (!result.ok) eq_(result.error.code, "ALREADY_ACCEPTED", "error code is ALREADY_ACCEPTED");

    console.log(`    → User sees "Already Connected" screen`);
  }

  // ── Scenario 1 — Existing user + correct email: full activation ───────────

  section("Scenario 1 — Existing user + correct email: full activation");
  {
    const { urlToken, inviteId } = await seedInvite(cleanupProUserId!, CLIENT_EMAIL, FUTURE);

    // Verify token resolves correctly before acceptance
    const resolution = await resolveInviteByToken(urlToken);
    assert(resolution !== null, "resolveInviteByToken finds the invite row");
    eq_(resolution?.invitedEmail, CLIENT_EMAIL, "invitedEmail matches seeded value");
    assert(!resolution?.alreadyAccepted, "invite not yet accepted");

    // Accept — must succeed; ANY error code is a hard test failure.
    const result = await acceptInviteByToken(
      urlToken,
      cleanupClientUserId!,
      "mpm_ultimate_monthly", // Ultimate → CLINICAL_REQUIRED gate clears
      "PAID_FULL",
    );

    if (!result.ok) {
      const errCode = result.error.code;
      assert(false,
        `Scenario 1 FAILED — expected activation to succeed but got error: ${errCode}` +
        ("message" in result.error ? ` (${(result.error as any).message})` : ""),
      );
    } else {
      assert(true, "invitation accepted — activation succeeded");
      assert(typeof result.result.membershipId === "string",
        `membershipId returned: ${result.result.membershipId}`);
      assert(typeof result.result.studioName === "string",
        `studioName returned: "${result.result.studioName}"`);
      console.log(`    → Connected! membershipId=${result.result.membershipId} studio="${result.result.studioName}"`);

      // DB assertions — care_invite.accepted must be flipped
      const [updatedInvite] = await db
        .select({ accepted: careInvite.accepted })
        .from(careInvite)
        .where(eq(careInvite.id, inviteId));
      assert(updatedInvite?.accepted === true, "care_invite.accepted is now true in DB");
    }
  }

  // ── Guard — unknown token ─────────────────────────────────────────────────

  section("Guard — unknown token: both helpers return null / NOT_FOUND");
  {
    const ghost = `ghost-token-${randomUUID()}`;
    assert((await resolveInviteByToken(ghost)) === null, "resolveInviteByToken returns null");
    assert((await getInviteMetadata(ghost)) === null,    "getInviteMetadata returns null");
    const r = await acceptInviteByToken(ghost, cleanupClientUserId!, null, "PAID_FULL");
    assert(r.ok === false, "acceptInviteByToken rejects unknown token");
    if (!r.ok) eq_(r.error.code, "NOT_FOUND", "error code is NOT_FOUND");
  }

} finally {

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(66)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  let cleanupOk = true;
  try {
    await cleanup();
  } catch {
    cleanupOk = false;
  }

  if (failMessages.length > 0) {
    console.log("\nFailures:");
    failMessages.forEach(m => console.log(m));
    exitCode = 1;
  } else if (!cleanupOk) {
    exitCode = 1;
  } else {
    console.log("✅ All ProCare invitation flow smoke tests passed");
  }
}

process.exit(exitCode);
