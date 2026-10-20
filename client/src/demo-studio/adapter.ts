import { computeDemoMacros, type DemoStore } from "./state";
import { emptyFoodInclusionPrioritiesDocument, normalizeFoodInclusionPrioritiesDocument } from "@shared/nutritionPriorities";
import type { NutritionPersonalizationSummary } from "@/types/nutritionSummary";
import { evaluateOrderedJourney, type JourneySnapshot } from "@shared/guidedJourney";
import { canAccessMealBuilders } from "@/lib/subscriptionCheck";
import type { WorkspaceAvailability } from "@shared/workspaceAvailability";
import type { StudioAccessStatus } from "@shared/studioAccess";
import { resolveAcademyProgression } from "@shared/academyProgression";

const builders: Record<string, { label: string; href: string }> = {
  general_nutrition: { label: "General Nutrition", href: "/general-nutrition-builder" },
  diabetic: { label: "Diabetic", href: "/diabetic-builder" },
  glp1: { label: "Metabolic Medication", href: "/glp1-builder" },
  anti_inflammatory: { label: "Anti-Inflammatory", href: "/anti-inflammatory-builder" },
  beach_body: { label: "Performance Nutrition", href: "/performance" },
};

export class UnsupportedDemoRequest extends Error {
  constructor(public method: string, public path: string) { super(`Not connected in Demo Mode Group 1: ${method} ${path}`); }
}

/** Exhaustive local routing. There is intentionally no original-fetch fallback. */
export async function demoRequest(store: DemoStore, input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (input.startsWith("https://demo.invalid/")) input = input.slice("https://demo.invalid".length);
  if (!input.startsWith("/") || input.startsWith("//")) throw new UnsupportedDemoRequest(method, input);
  const path = new URL(input, "https://demo.invalid").pathname;
  const uid = store.state.user.id;
  if (path.startsWith("/api/users/") && ![
    "/api/users/profile", `/api/users/${uid}/macro-targets`, `/api/users/${uid}/body-composition`,
    `/api/users/${uid}/body-composition/latest`, `/api/users/${uid}/compliance`,
  ].includes(path)) throw new UnsupportedDemoRequest(method, path);
  const body = init.body ? JSON.parse(String(init.body)) : {};
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { "Content-Type": "application/json", "X-MPM-Synthetic": "true" },
  });
  const user = () => store.state.user;
  const targets = () => store.state.targets;
  const builderId = user().selectedMealBuilder ?? "general_nutrition";
  const builder = builders[builderId] ?? builders.general_nutrition;
  const switchStatus = () => {
    const used = Number(user().builderChangesUsed ?? 0);
    const limit = 4; // Same ordinary-account allowance; never unlimited/admin access.
    return { changesUsed: used, changesRemaining: Math.max(0, limit - used),
      changeLimit: limit, canSwitch: used < limit, isUnlimited: false };
  };
  if (method === "GET") {
    // Landing-page status only: no enrollment, credential or MFA authority.
    if (path === "/api/auth/mfa/status") return json({ mfaEnabled: false, enrolledAt: null });
    if (path === "/api/certifications/academy-progression") return json(resolveAcademyProgression({
      completedPlatformLessonIds: [], completedMarketingModuleIds: [],
      legacyPlatformComplete: false, legacyMarketingComplete: false,
      specialistCredentialComplete: false, proCareTrainingComplete: false,
      proCareTrainingEligible: false,
    }));
    if (path === "/api/user/builder-switch-status") return json(switchStatus());
    if (path === "/api/kitchens/featured") return json({ kitchens: [] });
    if (path === "/api/business/mine" || path === "/api/business/membership") {
      return json({ error: "This synthetic client has no organization membership" }, 404);
    }
    const hubReads: Record<string, unknown> = {
      "/api/business/workspace/availability": { availability: {
        personal: { available: true, destination: "/dashboard" },
        organization: { available: false, destination: null, organizations: [] },
        studio: { available: false, destination: null, readiness: "professional_setup_required" },
      } satisfies WorkspaceAvailability },
      "/api/business/workspace/options": { organizations: [], workspaces: [] },
      "/api/business/workspaces": { workspaces: [] },
      "/api/business/check-status": { exists: false },
      "/api/business/workspace/studio-access": { studioAccess: {
        state: "inactive", sources: [], studioActive: false, studioReady: false,
        authorized: false, ownsOrganization: false, setupDestination: null,
        canStartStudioCheckout: false, billing: null,
      } satisfies StudioAccessStatus },
      "/api/business/workspace/organization-access": { organizationAccess: { organizations: [] } },
      "/api/business/removal-notice": { notice: null },
    };
    if (Object.hasOwn(hubReads, path)) return json(hubReads[path]);
    if (path === "/api/auth/csrf") return json({ csrfToken: "synthetic-demo-not-a-live-credential" });
    if (["/api/user/profile", "/api/users/profile"].includes(path)) return json(user());
    if (path === `/api/users/${uid}/macro-targets`) return json({ hasTargets: !!targets(), ...targets() });
    if (path === "/api/household/profiles") return json({ profiles: [], hasHousehold: false });
    if (path === "/api/household/active") return json({ activeProfileId: null, profile: null });
    if (path === "/api/org/config") return json({ organization: null, config: null });
    if (path === `/api/users/${uid}/body-composition/latest`) return json({ entry: store.state.bodyComposition, source: "synthetic" });
    if (path === "/api/biometrics/latest") return json({ weight: user().weight, samples: [] });
    if (path === "/api/prescription/clinical-status") return json({
      status: "standard_personalization", clinicalStatus: "standard_personalization", conditions: [], flags: {},
      hasClinicalContext: false, warnings: [], missingFields: [],
    });
    if (path === "/api/my-perfect-menu/effective-builder") return json({
      builder: { builderId, label: builder.label, displayName: builder.label,
        href: builder.href, subjectUserId: uid },
      builderId, effectiveBuilder: builderId,
      builderLabel: builder.label, subjectUserId: uid,
    });
    if (path === "/api/nutrition-priorities") return json({
      document: user().foodInclusionPriorities ?? emptyFoodInclusionPrioritiesDocument(),
    });
    if (path === "/api/guided-journey/progress") {
      const steps: JourneySnapshot["steps"] = [
        { id: "get_to_know_you", evidence: {
          state: user().onboardingCompletedAt ? "complete" : "incomplete",
          reason: "Synthetic onboarding save evidence",
        }, action: { kind: "open_existing_activity", route: "/onboarding" } },
        { id: "nutrition_targets", evidence: {
          state: targets() ? "complete" : "incomplete", reason: "Synthetic macro save evidence",
        }, action: { kind: "open_existing_activity", route: "/macro-counter" } },
        { id: "saved_meal_plan", evidence: {
          state: "not_applicable", reason: "Meal planning is outside Phase 1 Demo Mode",
        }, action: null },
      ];
      return json({ version: 1, journeyType: "personal",
        scope: { actorId: uid, subjectId: uid, workspace: "personal" },
        steps, ...evaluateOrderedJourney(steps),
        builderKey: null, savedPlan: null, completionGoal: "personal_setup",
      });
    }
    if (path === "/api/nutrition-summary/baseline") {
      const t = targets();
      const summary: NutritionPersonalizationSummary = {
        activeInputs: { health: [], performance: null, pregnancy: null, therapeutic: null,
          cuisine: user().cuisinePreference ?? null, dietary: user().dietaryRestrictions ?? [],
          goal: t ? user().fitnessGoal ?? user().goalType ?? null : user().goalType ?? null, macros: t ? {
            calories: t.calories, proteinG: t.protein_g, carbsG: t.carbs_g, fatG: t.fat_g,
            starchyCarbsG: t.starchyCarbs_g ?? null, fibrousCarbsG: t.fibrousCarbs_g ?? null,
          } : null },
        dietaryIdentity: user().dietaryRestrictions ?? [], mealBuilderLabel: builder.label,
        nutritionDrivers: { medicalConditions: [], therapeuticInputs: [], liveMetrics: [] },
        nutritionPriorities: [], foodInclusionPriorityIds: user().foodInclusionPriorities?.selectedPriorityIds ?? [],
        compositeExplanation: "Synthetic Demo Mode reflects your saved onboarding and nutrition targets.",
        conflictPolicy: "This nonclinical walkthrough does not run live clinical or prescription services.",
        hasAnyActiveProtocol: false, carbCycleActive: false, alphaGal: null,
        professionalUpdates: [], meta: { generatedAt: new Date().toISOString() },
      };
      return json(summary);
    }
    if (path === "/api/nutrition-summary/dynamic") return json({
      nextDayBoundaryAt: new Date(Date.now() + 86_400_000).toISOString(),
      performance: null, pregnancy: null, liveMetrics: [], professionalUpdates: [],
      compositeExplanation: "Synthetic Demo Mode reflects your saved onboarding and nutrition targets.",
    });
    if (path === `/api/users/${uid}/compliance`) return json({
      status: targets() ? "ready" : "no_targets", reason: targets() ? null : "no_targets",
      score: null, consistencyScore: null, hasTargets: !!targets(), samples: [], days: [], totalDays: 0,
      loggedDays7: 0, mealActivity: { expectedMealCount: 0 },
    });
    // Explicitly empty, synthetic peripheral state for the real dashboard widgets.
    const emptyReads: Record<string, unknown> = {
      "/api/client/tablet": { messages: [], entries: [], connected: false },
      "/api/pro/connection-status": { connected: false },
      "/api/pro/unread-count": { count: 0, unreadCount: 0 },
      "/api/pro/tablet/unread-summary": { totalUnread: 0 },
      "/api/pattern-alerts": { alerts: [] },
      "/api/hydration/today": { totalMl: 0, targetMl: 2200, entries: [], status: "not_started" },
      "/api/nutrition-state": { targets: targets(), userId: uid },
      "/api/nutrition-priorities": { priorities: [], selectedPriorities: [] },
      "/api/user/nutrition-priorities": { priorities: [], selectedPriorities: [] },
      "/api/nutrition-life-plan/self-summary": { summary: null, saved: false },
    };
    if (Object.prototype.hasOwnProperty.call(emptyReads, path)) return json(emptyReads[path]);
  }
  if (["PUT", "PATCH", "POST"].includes(method)) {
    if (path === "/api/user/meal-builder" && method === "PATCH") {
      if (!canAccessMealBuilders(user())) return json({ error: "Meal Builder access is required" }, 403);
      const selected = body.selectedMealBuilder;
      if (typeof selected !== "string" || !Object.hasOwn(builders, selected)) {
        return json({ error: "This builder is not available for selection" }, 400);
      }
      if (selected !== builderId) {
        if (!switchStatus().canSwitch) return json({ error: "Demo builder switch limit reached",
          switchStatus: switchStatus() }, 403);
        store.state = { ...store.state, user: { ...user(),
          builderChangesUsed: switchStatus().changesUsed + 1 } };
        store.patchUser({ selectedMealBuilder: selected, preferredBuilder: selected });
      }
      return json({ success: true, selectedMealBuilder: selected, switchStatus: switchStatus() });
    }
    if (path === "/api/users/profile" || path === "/api/user/preferences") {
      store.patchUser(body); return json({ ...user(), success: true, user: user() });
    }
    if (path === "/api/user/complete-onboarding") {
      store.patchUser({ onboardingCompletedAt: new Date().toISOString() });
      return json({ success: true, user: user() });
    }
    if (path === "/api/user/specialty-condition") {
      store.patchUser({ specialtyConditions: body.conditions ?? [], oncologySupportContext: body.oncologySupport ?? null });
      return json({ success: true, user: user() });
    }
    if (path === "/api/user/thyroid-type") {
      store.patchUser({ thyroidType: body.thyroidType }); return json({ success: true });
    }
    if (path === "/api/user/oncology-support-intent") {
      store.patchUser({ oncologySupportIntent: body.intent ?? null });
      return json({ success: true, user: user() });
    }
    if (path === "/api/user/safety-pin/set" || path === "/api/safety-pin/set") {
      // Do not store or echo a PIN, even in synthetic state.
      return json({ success: true, synthetic: true });
    }
    if (path === "/api/macro-calculator/compute") return json(computeDemoMacros(body));
    if (path === "/api/nutrition-priorities") {
      const document = normalizeFoodInclusionPrioritiesDocument(body);
      store.patchUser({ foodInclusionPriorities: document }); return json({ document });
    }
    if (path === `/api/users/${uid}/macro-targets`) {
      const keys = ["calories", "protein_g", "carbs_g", "fat_g"];
      if (!keys.every(k => Number.isFinite(body[k]) && body[k] >= 0)) return json({ error: "Invalid demo targets" }, 400);
      store.state = { ...store.state, targets: { ...body } };
      store.patchUser({ hasSavedMacroProfile: true, dailyCalorieTarget: body.calories,
        dailyProteinTarget: body.protein_g, dailyCarbsTarget: body.carbs_g, dailyFatTarget: body.fat_g });
      return json({ ...body, success: true });
    }
    if (path === `/api/users/${uid}/body-composition`) {
      store.state = { ...store.state, bodyComposition: body }; store.changed(); return json({ ...body, success: true });
    }
    if (path === "/api/biometrics/weight") {
      const kg = body.unit === "lb" ? Number(body.value) * .45359237 : Number(body.value);
      if (Number.isFinite(kg)) store.patchUser({ weight: kg });
      return json({ success: true, weight: kg });
    }
    if (path === "/api/biometrics/ingest") return json({ success: true, synthetic: true });
    if (path === "/api/prescription/clinical-context") return json({
      success: true, status: "standard_personalization", synthetic: true,
    });
    if (path === "/api/prescription/starch-preferences") {
      store.patchUser(body); return json({ success: true, ...body });
    }
  }
  throw new UnsupportedDemoRequest(method, path);
}
