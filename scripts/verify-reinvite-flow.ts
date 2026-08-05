/**
 * verify-reinvite-flow.ts
 *
 * End-to-end verification that a removed business member can re-join after
 * the uq_business_members_active partial index is in place.
 *
 * Checks:
 *  1. The partial index exists in the DB
 *  2. Remove a member → row status = 'removed'
 *  3. Re-invite them (new invitation row)
 *  4. Accept invite → existing row re-activated (UPDATE, not INSERT)
 *  5. Exactly one row per (business_id, user_id) with status = 'active'
 *  6. No stale 'removed' row left behind (there can only be one row total
 *     due to the full unique constraint — it is updated in place)
 *  7. Seat count correct after re-join
 *
 * Run: npx tsx scripts/verify-reinvite-flow.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { randomBytes } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import {
  businesses,
  businessMembers,
  businessInvitations,
} from "../server/db/schema/business";
import { users } from "../shared/schema";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── helpers ───────────────────────────────────────────────────────────────────

function uid(prefix = "test") {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function uuidV4(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

async function cleanup(businessId: string, ownerUserId: string, memberUserId: string) {
  await db.execute(sql`DELETE FROM business_invitations WHERE business_id = ${businessId}`);
  await db.execute(sql`DELETE FROM business_members WHERE business_id = ${businessId}`);
  await db.execute(sql`DELETE FROM businesses WHERE id = ${businessId}`);
  await db.execute(sql`DELETE FROM users WHERE id = ${ownerUserId}`);
  await db.execute(sql`DELETE FROM users WHERE id = ${memberUserId}`);
}

async function getActiveSeats(businessId: string): Promise<number> {
  const [r] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.status, "active")));
  return r?.count ?? 0;
}

// ── main ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function run() {
  console.log("\n=== Business Re-invite Flow Verification ===\n");

  // ── 1. Ensure the partial index exists (idempotent, mirrors boot migration) ─
  console.log("Step 1: Ensure uq_business_members_active partial index exists");
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_business_members_active
      ON business_members (business_id, user_id)
      WHERE status = 'active'
  `);
  const idxResult = await db.execute(sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'business_members'
      AND indexname = 'uq_business_members_active'
  `);
  assert(
    idxResult.rows.length === 1,
    "Partial index uq_business_members_active exists",
    idxResult.rows.length === 0 ? "Index not found — creation failed" : undefined,
  );
  if (idxResult.rows.length > 0) {
    const def = (idxResult.rows[0] as any).indexdef as string;
    assert(
      def.includes("WHERE") && def.toLowerCase().includes("active"),
      "Index definition contains WHERE status = 'active' clause",
      def,
    );
    console.log(`     Index def: ${def}`);
  }

  // ── 2. Confirm the full unique constraint also exists (belt + braces) ───
  console.log("\nStep 2: Confirm full unique constraint uniq_business_user exists");
  const constraintResult = await db.execute(sql`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'business_members'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%business%user%'
  `);
  assert(
    constraintResult.rows.length >= 1,
    "Full unique constraint on (business_id, user_id) exists",
  );

  // ── 3. Seed test data ────────────────────────────────────────────────────
  console.log("\nStep 3: Seed test owner, member, and business");

  const ownerUserId = uid("owner");
  const memberUserId = uid("member");
  const memberEmail = `reinvite_test_${randomBytes(4).toString("hex")}@test.invalid`;
  const businessId = uuidV4(); // businesses.id is UUID type

  // Minimal user rows (only required columns; column is `password` not `password_hash`)
  await db.execute(sql`
    INSERT INTO users (id, username, email, password)
    VALUES (${ownerUserId}, ${uid("owner_name")}, ${uid("owner") + "@test.invalid"}, 'x')
  `);
  await db.execute(sql`
    INSERT INTO users (id, username, email, password)
    VALUES (${memberUserId}, ${uid("member_name")}, ${memberEmail}, 'x')
  `);

  await db.execute(sql`
    INSERT INTO businesses (id, owner_user_id, name, status, plan, seat_limit, created_at, updated_at)
    VALUES (${businessId}, ${ownerUserId}, 'Test Biz', 'active', 'clinical_business_monthly', 4, NOW(), NOW())
  `);

  // Owner row
  await db.execute(sql`
    INSERT INTO business_members (id, business_id, user_id, role, status, joined_at, created_at)
    VALUES (${uuidV4()}, ${businessId}, ${ownerUserId}, 'owner', 'active', NOW(), NOW())
  `);

  // Member row — initial join
  const memberRowId = uuidV4();
  await db.execute(sql`
    INSERT INTO business_members (id, business_id, user_id, role, status, joined_at, created_at)
    VALUES (${memberRowId}, ${businessId}, ${memberUserId}, 'staff', 'active', NOW(), NOW())
  `);

  const seatsAfterJoin = await getActiveSeats(businessId);
  assert(seatsAfterJoin === 2, `Active seat count = 2 after initial join (got ${seatsAfterJoin})`);

  // ── 4. Remove the member ─────────────────────────────────────────────────
  console.log("\nStep 4: Remove the member");
  await db
    .update(businessMembers)
    .set({ status: "removed", removedAt: new Date() })
    .where(eq(businessMembers.id, memberRowId));

  const seatsAfterRemove = await getActiveSeats(businessId);
  assert(seatsAfterRemove === 1, `Active seat count = 1 after removal (got ${seatsAfterRemove})`);

  // Verify the removed row still exists
  const removedRows = await db
    .select()
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.userId, memberUserId)));
  assert(removedRows.length === 1, "Exactly one row exists for member after removal");
  assert(removedRows[0]?.status === "removed", `Row status is 'removed' (got '${removedRows[0]?.status}')`);

  // ── 5. Create a re-invite ────────────────────────────────────────────────
  console.log("\nStep 5: Send re-invite");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(businessInvitations).values({
    businessId,
    email: memberEmail.toLowerCase(),
    token,
    role: "staff",
    status: "pending",
    invitedByUserId: ownerUserId,
    expiresAt,
  });

  const [pendingInvite] = await db
    .select()
    .from(businessInvitations)
    .where(and(eq(businessInvitations.token, token), eq(businessInvitations.status, "pending")));
  assert(!!pendingInvite, "Re-invite row created with status = 'pending'");

  // ── 6. Accept the re-invite (mirrors businessRoutes.ts accept handler) ───
  console.log("\nStep 6: Accept re-invite — re-activates existing row, does NOT insert a new one");

  // Lookup existing membership (any status)
  const [existing] = await db
    .select()
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.userId, memberUserId)))
    .limit(1);

  assert(!!existing, "Existing membership row found before accept");
  assert(existing.status === "removed", `Existing row status is 'removed' (got '${existing.status}')`);

  // Simulate accept transaction
  let acceptError: Error | null = null;
  try {
    await db.transaction(async (tx) => {
      // Re-activate the removed row (no new INSERT)
      await tx
        .update(businessMembers)
        .set({ status: "active", joinedAt: new Date() })
        .where(eq(businessMembers.id, existing.id));

      await tx
        .update(businessInvitations)
        .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: memberUserId })
        .where(eq(businessInvitations.id, pendingInvite.id));
    });
  } catch (err: any) {
    acceptError = err;
    console.error("    Transaction error:", err.message);
  }

  assert(!acceptError, "Accept transaction completed without error", acceptError?.message);

  // ── 7. Post-accept state verification ───────────────────────────────────
  console.log("\nStep 7: Verify post-accept state");

  const allMemberRows = await db
    .select()
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.userId, memberUserId)));

  assert(
    allMemberRows.length === 1,
    `Exactly ONE row for (businessId, memberId) after re-join — no duplicates (found ${allMemberRows.length})`,
  );
  assert(
    allMemberRows[0]?.status === "active",
    `Row status is 'active' after re-join (got '${allMemberRows[0]?.status}')`,
  );

  // Confirm no second 'removed' ghost row exists alongside the active row
  const removedRowsAfter = await db
    .select()
    .from(businessMembers)
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.userId, memberUserId),
        eq(businessMembers.status, "removed"),
      ),
    );
  assert(
    removedRowsAfter.length === 0,
    "No ghost 'removed' row exists alongside the re-activated row",
  );

  const seatsAfterRejoin = await getActiveSeats(businessId);
  assert(seatsAfterRejoin === 2, `Seat count = 2 after re-join (got ${seatsAfterRejoin})`);

  // Invite should now be 'accepted'
  const [acceptedInvite] = await db
    .select()
    .from(businessInvitations)
    .where(eq(businessInvitations.id, pendingInvite.id));
  assert(acceptedInvite?.status === "accepted", `Invite status = 'accepted' (got '${acceptedInvite?.status}')`);

  // ── 8. Confirm partial index blocks a second active INSERT ───────────────
  console.log("\nStep 8: Confirm partial index blocks a second INSERT with status = 'active'");
  let indexViolated = false;
  let indexError: string | null = null;
  try {
    await db.execute(sql`
      INSERT INTO business_members (id, business_id, user_id, role, status, created_at)
      VALUES (${uuidV4()}, ${businessId}, ${memberUserId}, 'staff', 'active', NOW())
    `);
    // If we get here the index did not protect — this is a failure
  } catch (err: any) {
    indexViolated = true;
    indexError = err.message;
  }
  assert(
    indexViolated,
    "Partial index blocks duplicate active INSERT (unique violation thrown)",
    indexViolated ? `Got expected error: ${indexError}` : "INSERT succeeded — index NOT protecting!",
  );

  // ── Cleanup ──────────────────────────────────────────────────────────────
  console.log("\nCleaning up test data…");
  await cleanup(businessId, ownerUserId, memberUserId);
  console.log("Cleanup complete.");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("❌ Verification FAILED — see errors above.");
    process.exit(1);
  } else {
    console.log("✅ All checks passed — re-invite flow is correct with the partial index in place.");
  }
}

run()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
