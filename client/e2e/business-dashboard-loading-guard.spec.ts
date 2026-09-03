/**
 * Playwright — BusinessDashboard loading-guard invariant
 *
 * The component has a documented invariant (see invariant comment ~line 119 and
 * the guard ~line 488 in BusinessDashboard.tsx): while `loading || polling` is
 * true, ONLY the generic spinner may render — no membership-status-dependent
 * UI (removal notices, member banners, owner dashboards, etc.).
 *
 * These tests mount the page with a delayed /api/business/* response and
 * assert that nothing except the spinner is visible during the loading window.
 * They fail if any membership-status UI leaks above the guard.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ── Text / selectors that are ONLY present in membership-status UI ────────────
// If any of these appear before the API responds, the loading guard is broken.
const MEMBER_UI_SELECTORS = [
  // member welcome banner
  "text=Organization Access Active",
  "text=Organization Member",
  "text=Welcome to the team",
  "text=Your Path to Working with Clients",
  // owner dashboard
  "text=Active Members",
  "text=Pending Invitations",
  "text=Invite Member",
  "text=Manage Seats",
  "text=Business Name",
  // "no business" screen — also membership-dependent
  "text=No Business Account Found",
];

// Text that MUST be visible while loading
const SPINNER_TEXT = "Loading…";

// ── Shared mock helpers ───────────────────────────────────────────────────────

/** Respond to every auth/session/org call immediately so the app can mount. */
async function mockAuthAndOrg(page: Page) {
  const fakeUser = {
    id: "test-user-guard",
    email: "guard@test.example",
    name: "Guard Tester",
    planLookupKey: "procare_professional",
    entitlements: [],
    subscriptionStatus: "active",
    trialEndsAt: null,
    isEmailVerified: true,
    createdAt: new Date().toISOString(),
  };

  await page.route("/api/user/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeUser) })
  );

  await page.route("/api/auth/session", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true }) })
  );

  await page.route("/api/org/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        featureFlags: {
          requireAcademy: true,
          requireProfessionalVerification: true,
        },
      }),
    })
  );

  await page.route("/api/user/preferences", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );
}

/**
 * Install a route handler that holds the business API calls for `delayMs`
 * milliseconds before resolving with `body`. Returns a cleanup function that
 * immediately aborts any pending held request.
 */
function delayRoute(
  page: Page,
  pattern: string,
  delayMs: number,
  status: number,
  body: object
): { release: () => void } {
  let pending: Route[] = [];
  let released = false;

  page.route(pattern, async (route) => {
    if (released) {
      // Guard is already down — fulfil immediately (for post-load assertions)
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    pending.push(route);
    // Wait until release() is called
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        if (released) { clearInterval(id); resolve(); }
      }, 50);
    });
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });

  return {
    release() {
      released = true;
      pending = [];
    },
  };
}

// ── Test: spinner-only during load when membership API is delayed ─────────────

test.describe("BusinessDashboard loading guard", () => {
  test("shows only generic spinner while /api/business/membership is pending (member response)", async ({
    page,
  }) => {
    await mockAuthAndOrg(page);

    // /api/business/mine returns 404 (not an owner)
    let mineReleased = false;
    await page.route("/api/business/mine", async (route) => {
      if (!mineReleased) {
        // Hold for up to 10 s — released by the signal below
        await new Promise<void>((res) => {
          const iv = setInterval(() => { if (mineReleased) { clearInterval(iv); res(); } }, 50);
        });
      }
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) });
    });

    let membershipReleased = false;
    const membershipBody = {
      membership: {
        role: "coach",
        businessName: "Acme Fitness",
        seatLimit: 10,
        joinedAt: new Date().toISOString(),
        independentClientPolicy: "allowed",
      },
    };
    await page.route("/api/business/membership", async (route) => {
      if (!membershipReleased) {
        await new Promise<void>((res) => {
          const iv = setInterval(() => { if (membershipReleased) { clearInterval(iv); res(); } }, 50);
        });
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(membershipBody) });
    });

    await page.goto("/business-dashboard");

    // ── Assert: only the spinner is visible during the loading window ──────────
    await expect(page.getByText(SPINNER_TEXT)).toBeVisible({ timeout: 5000 });

    for (const selector of MEMBER_UI_SELECTORS) {
      await expect(page.locator(selector)).not.toBeVisible();
    }

    // Confirm the spinner's parent container is the ONLY content (no hidden
    // membership-status nodes rendered off-screen either)
    const memberUiCount = await page.evaluate(() => {
      const phrases = [
        "Organization Access Active",
        "Organization Member",
        "Welcome to the team",
        "Active Members",
        "Pending Invitations",
        "No Business Account Found",
      ];
      return phrases.filter((p) => document.body.innerText.includes(p)).length;
    });
    expect(memberUiCount).toBe(0);

    // ── Release the APIs and verify the member view renders ───────────────────
    mineReleased = true;
    membershipReleased = true;

    await expect(page.getByText("Organization Access Active")).toBeVisible({ timeout: 8000 });
    // Spinner must be gone
    await expect(page.getByText(SPINNER_TEXT)).not.toBeVisible();
  });

  test("shows only generic spinner while /api/business/mine is pending (owner response)", async ({
    page,
  }) => {
    await mockAuthAndOrg(page);

    let mineReleased = false;
    const ownerBody = {
      business: {
        id: "biz-test-1",
        name: "Test Business",
        seatLimit: 5,
        status: "active",
        plan: "procare_professional",
        independentClientPolicy: "allowed",
      },
      members: [],
      invitations: [],
      usedSeats: 0,
      availableSeats: 5,
      planLostCount: 0,
    };

    await page.route("/api/business/mine", async (route) => {
      if (!mineReleased) {
        await new Promise<void>((res) => {
          const iv = setInterval(() => { if (mineReleased) { clearInterval(iv); res(); } }, 50);
        });
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ownerBody) });
    });

    // membership should not be called when /mine succeeds, but mock it anyway
    await page.route("/api/business/membership", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) })
    );

    await page.goto("/business-dashboard");

    // ── While APIs are pending, only the spinner renders ──────────────────────
    await expect(page.getByText(SPINNER_TEXT)).toBeVisible({ timeout: 5000 });

    for (const selector of MEMBER_UI_SELECTORS) {
      await expect(page.locator(selector)).not.toBeVisible();
    }

    const memberUiCount = await page.evaluate(() => {
      const phrases = [
        "Organization Access Active",
        "Organization Member",
        "Active Members",
        "Invite Member",
        "No Business Account Found",
      ];
      return phrases.filter((p) => document.body.innerText.includes(p)).length;
    });
    expect(memberUiCount).toBe(0);

    // ── Release and verify owner view renders ─────────────────────────────────
    mineReleased = true;

    // Owner view shows the member list section
    await expect(page.getByText("Active Members")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(SPINNER_TEXT)).not.toBeVisible();
  });

  test("no membership-status text in the DOM during the loading window — regression guard", async ({
    page,
  }) => {
    // This test is intentionally strict: it polls the DOM several times during
    // the loading window to ensure nothing slips through.  A future contributor
    // who accidentally hoists a removal-notice banner above the loading guard
    // will cause this test to fail.
    await mockAuthAndOrg(page);

    let apisReleased = false;

    await page.route("/api/business/mine", async (route) => {
      if (!apisReleased) {
        await new Promise<void>((res) => {
          const iv = setInterval(() => { if (apisReleased) { clearInterval(iv); res(); } }, 50);
        });
      }
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) });
    });

    await page.route("/api/business/membership", async (route) => {
      if (!apisReleased) {
        await new Promise<void>((res) => {
          const iv = setInterval(() => { if (apisReleased) { clearInterval(iv); res(); } }, 50);
        });
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        membership: {
          role: "trainer",
          businessName: "Removal Test Gym",
          seatLimit: 4,
          joinedAt: new Date().toISOString(),
          independentClientPolicy: "org_only",
        },
      })});
    });

    await page.goto("/business-dashboard");

    // Poll the DOM 5 times over the first 2 seconds (every 400 ms).
    // Each snapshot must contain ONLY spinner-related content.
    const FORBIDDEN_PHRASES = [
      "Organization Access Active",
      "Organization Member",
      "Welcome to the team",
      "Active Members",
      "Pending Invitations",
      "Invite Member",
      "No Business Account Found",
      "Removal Test Gym",   // org-specific name must not appear until load completes
    ];

    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(400);
      const bodyText = await page.evaluate(() => document.body.innerText);
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(bodyText, `"${phrase}" leaked into DOM during loading window (poll #${i + 1})`).not.toContain(phrase);
      }
      // Spinner text must be present
      expect(bodyText, `Spinner text missing from DOM during loading window (poll #${i + 1})`).toContain(SPINNER_TEXT);
    }

    // Release APIs — org name should now appear
    apisReleased = true;
    await expect(page.getByText("Organization Access Active")).toBeVisible({ timeout: 8000 });
  });
});
