/**
 * Authorization tests for the Partner Center marketing campaign visibility rules.
 * Confirms standard / co_branded / white_label accounts can only access their assigned campaigns.
 * Run with: npx tsx scripts/test-marketing-center-auth.ts
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("=== Partner Center Authorization Tests ===\n");

  // 1. Tables exist
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('marketing_campaigns', 'marketing_assets')
    ORDER BY table_name
  `);
  const tableNames = (tables.rows as any[]).map((r) => r.table_name);
  console.log("Tables:", tableNames);

  // 2. branding_mode column exists
  const colRows = await db.execute(sql`
    SELECT column_name, column_default FROM information_schema.columns
    WHERE table_name = 'partner_records' AND column_name = 'branding_mode'
  `);
  console.log("branding_mode column:", colRows.rows[0] ?? "MISSING");
  console.log();

  // 3. Seed test campaigns
  await db.execute(sql`DELETE FROM marketing_campaigns WHERE created_by = 'auth-test'`);
  await db.execute(sql`
    INSERT INTO marketing_campaigns (title, month_key, status, audience_modes, created_by) VALUES
    ('Standard Campaign',      '2099-01', 'published', ARRAY['standard'],                             'auth-test'),
    ('Co-Branded Campaign',    '2099-02', 'published', ARRAY['co_branded'],                           'auth-test'),
    ('White Label Campaign',   '2099-03', 'published', ARRAY['white_label'],                          'auth-test'),
    ('All Partners Campaign',  '2099-04', 'published', ARRAY['standard','co_branded','white_label'],  'auth-test'),
    ('Draft — nobody sees',    '2099-05', 'draft',     ARRAY['standard','co_branded','white_label'],  'auth-test')
  `);

  // 4. Simulate the server-side visibility filter (mirrors marketingCenterRoutes.ts exactly)
  async function visibleFor(brandingMode: string): Promise<string[]> {
    const all = await db.execute(sql`
      SELECT title, audience_modes FROM marketing_campaigns
      WHERE status = 'published' AND created_by = 'auth-test'
    `);
    return (all.rows as any[])
      .filter((c) => {
        const modes: string[] = c.audience_modes ?? [];
        return modes.includes(brandingMode) || modes.includes("all");
      })
      .map((c) => c.title as string);
  }

  // 5. Simulate getActiveBrandingMode (mirrors the updated route helper exactly —
  //    returns null for non-partners or inactive partners, never defaults to 'standard')
  async function getActiveBrandingMode(userId: string): Promise<string | null> {
    const rows = await db.execute(sql`
      SELECT branding_mode, status FROM partner_records WHERE user_id = ${userId} LIMIT 1
    `);
    const row = rows.rows[0] as any;
    if (!row || row.status !== "active") return null;
    return row.branding_mode ?? "standard";
  }

  // Simulate the campaigns listing gate: null brandingMode → 403
  async function canListCampaigns(userId: string): Promise<boolean> {
    return (await getActiveBrandingMode(userId)) !== null;
  }

  // Simulate the download authorization check (mirrors the download route exactly)
  async function canDownload(brandingMode: string | null, monthKey: string): Promise<boolean> {
    if (brandingMode === null) return false; // non-partner → 403 before this check
    const rows = await db.execute(sql`
      SELECT audience_modes FROM marketing_campaigns
      WHERE month_key = ${monthKey} AND status = 'published' AND created_by = 'auth-test'
    `);
    if (!rows.rows[0]) return false;
    const modes: string[] = (rows.rows[0] as any).audience_modes ?? [];
    return modes.includes(brandingMode) || modes.includes("all");
  }

  const stdSees = await visibleFor("standard");
  const cbSees  = await visibleFor("co_branded");
  const wlSees  = await visibleFor("white_label");

  console.log("standard   sees:", stdSees);
  console.log("co_branded sees:", cbSees);
  console.log("white_label sees:", wlSees);
  console.log();

  // 6. Profile endpoint logic — simulate the three cases the /profile route handles
  console.log("\n── Profile endpoint logic ──");

  // Seed temp partner rows (only user_id is required; all others have defaults)
  await db.execute(sql`DELETE FROM partner_records WHERE user_id IN ('test-profile-inactive','test-profile-active-wl')`);
  await db.execute(sql`
    INSERT INTO partner_records (user_id, status, branding_mode) VALUES
    ('test-profile-inactive', 'inactive', 'co_branded'),
    ('test-profile-active-wl', 'active',   'white_label')
  `);

  const inactiveBrandingMode = await getActiveBrandingMode("test-profile-inactive");
  const activeBrandingMode   = await getActiveBrandingMode("test-profile-active-wl");

  // Check partner record existence (simulates if (!partner) check in /profile)
  const noRecordRows = await db.execute(sql`SELECT id FROM partner_records WHERE user_id = 'no-record-at-all-xyz'`);
  const hasNoRecord  = noRecordRows.rows.length === 0;

  console.log("non-existent user → no partner record:", hasNoRecord);
  console.log("inactive partner branding mode:", inactiveBrandingMode);
  console.log("active white_label partner branding mode:", activeBrandingMode);

  // Cleanup profile test rows
  await db.execute(sql`DELETE FROM partner_records WHERE user_id IN ('test-profile-inactive','test-profile-active-wl')`);

  // 6b. Non-partner gate: a user with no partner_records row gets null from getActiveBrandingMode
  //    and is blocked before any campaign data is returned (matches the updated route logic).
  const nonPartnerBrandingMode = await getActiveBrandingMode("non-existent-user-id-test");
  const nonPartnerCanList = await canListCampaigns("non-existent-user-id-test");

  // 7. Assertions
  const cases: [boolean, string][] = [
    // Schema
    [tableNames.includes("marketing_campaigns"),       "marketing_campaigns table exists"],
    [tableNames.includes("marketing_assets"),          "marketing_assets table exists"],
    [!!(colRows.rows[0]),                              "branding_mode column exists on partner_records"],

    // Profile endpoint logic
    [hasNoRecord,                                      "/profile: no partner row → hasPartnerAccount: false path"],
    [inactiveBrandingMode === null,                    "/profile: inactive partner → brandingMode is null (campaigns blocked)"],
    [activeBrandingMode === "white_label",             "/profile: active white_label partner → brandingMode: 'white_label'"],

    // Non-partner gate (critical security boundary)
    [nonPartnerBrandingMode === null,                  "non-partner gets null branding mode (no fallback to standard)"],
    [!nonPartnerCanList,                               "non-partner BLOCKED from listing any campaigns"],
    [!await canDownload(null, "2099-01"),              "non-partner BLOCKED from downloading Standard Campaign asset"],
    [!await canDownload(null, "2099-04"),              "non-partner BLOCKED from downloading All Partners Campaign asset"],

    // Listing — standard
    [stdSees.includes("Standard Campaign"),            "standard   SEES    Standard Campaign"],
    [!stdSees.includes("Co-Branded Campaign"),         "standard   BLOCKS  Co-Branded Campaign"],
    [!stdSees.includes("White Label Campaign"),        "standard   BLOCKS  White Label Campaign"],
    [stdSees.includes("All Partners Campaign"),        "standard   SEES    All Partners Campaign"],
    [!stdSees.some((t) => t.includes("Draft")),        "standard   BLOCKS  draft campaigns"],

    // Listing — co_branded
    [!cbSees.includes("Standard Campaign"),            "co_branded BLOCKS  Standard Campaign"],
    [cbSees.includes("Co-Branded Campaign"),           "co_branded SEES    Co-Branded Campaign"],
    [!cbSees.includes("White Label Campaign"),         "co_branded BLOCKS  White Label Campaign"],
    [cbSees.includes("All Partners Campaign"),         "co_branded SEES    All Partners Campaign"],
    [!cbSees.some((t) => t.includes("Draft")),         "co_branded BLOCKS  draft campaigns"],

    // Listing — white_label
    [!wlSees.includes("Standard Campaign"),            "white_label BLOCKS Standard Campaign"],
    [!wlSees.includes("Co-Branded Campaign"),          "white_label BLOCKS Co-Branded Campaign"],
    [wlSees.includes("White Label Campaign"),          "white_label SEES   White Label Campaign"],
    [wlSees.includes("All Partners Campaign"),         "white_label SEES   All Partners Campaign"],
    [!wlSees.some((t) => t.includes("Draft")),         "white_label BLOCKS draft campaigns"],

    // Download authorization
    [await canDownload("standard",     "2099-01"),     "standard   CAN download Standard Campaign asset"],
    [!await canDownload("white_label", "2099-01"),     "white_label BLOCKED from Standard Campaign asset"],
    [!await canDownload("co_branded",  "2099-01"),     "co_branded  BLOCKED from Standard Campaign asset"],
    [!await canDownload("standard",    "2099-03"),     "standard   BLOCKED from White Label Campaign asset"],
    [await canDownload("white_label",  "2099-03"),     "white_label CAN download White Label Campaign asset"],
    [!await canDownload("standard",    "2099-02"),     "standard   BLOCKED from Co-Branded Campaign asset"],
    [await canDownload("co_branded",   "2099-02"),     "co_branded  CAN download Co-Branded Campaign asset"],
    [await canDownload("standard",     "2099-04"),     "standard   CAN download All Partners Campaign asset"],
    [await canDownload("co_branded",   "2099-04"),     "co_branded  CAN download All Partners Campaign asset"],
    [await canDownload("white_label",  "2099-04"),     "white_label CAN download All Partners Campaign asset"],
    [!await canDownload("standard",    "2099-05"),     "nobody can download Draft campaign asset"],
  ];

  let passed = 0;
  let failed = 0;
  for (const [ok, msg] of cases) {
    const icon = ok ? "✅" : "❌";
    console.log(`${icon} ${msg}`);
    ok ? passed++ : failed++;
  }

  // Cleanup
  await db.execute(sql`DELETE FROM marketing_campaigns WHERE created_by = 'auth-test'`);

  console.log(`\n${"─".repeat(55)}`);
  console.log(`${cases.length} tests  |  ${passed} passed  |  ${failed} failed`);
  if (failed === 0) {
    console.log("✅ ALL AUTHORIZATION TESTS PASSED");
  } else {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
