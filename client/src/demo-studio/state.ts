import type { User } from "@/lib/auth";
import { assertSyntheticIdentity } from "./authority";
import { macroCalculatorStorageKeys } from "@/lib/macroCalculatorResume";
import { demoDestination, blockedDestination } from "./navigation";

export type DemoWorkflow = "onboarding" | "macro" | "dashboard";
export interface DemoState {
  version: 1;
  user: User & Record<string, any>;
  targets: Record<string, any> | null;
  local: Record<string, string>;
  session: Record<string, string>;
  workflow: DemoWorkflow | null;
  path: string;
  bodyComposition: Record<string, any> | null;
  journeyStarted?: boolean;
  navigation?: { entries: string[]; index: number };
}

/** Deliberately synthetic, nonclinical illustration; never a clinical resolver. */
export function computeDemoMacros(input: Record<string, any>) {
  const kg = Number(input.kg ?? 86.18), cm = Number(input.cm ?? 177.8);
  const age = Number(input.age ?? 42);
  if (![kg, cm, age].every(Number.isFinite) || kg <= 0 || cm <= 0 || age < 18) {
    throw new Error("This adult walkthrough requires valid age, height, and weight");
  }
  const bmr = Math.round(10 * kg + 6.25 * cm - 5 * age + (input.sex === "female" ? -161 : 5));
  const multiplier: Record<string, number> = {
    sedentary: 1.2, light: 1.375, lightly_active: 1.375, moderate: 1.55,
    moderately_active: 1.55, active: 1.725, very_active: 1.725, very: 1.9,
  };
  const tdee = Math.round(bmr * (multiplier[input.activity] ?? 1.55));
  const target = Math.max(1500, tdee + (["loss", "weight_loss", "lose"].includes(input.goal) ? -350
    : ["gain", "muscle_gain"].includes(input.goal) ? 250 : 0));
  const protein = Math.round(target * .30 / 4), fat = Math.round(target * .30 / 9);
  const carbs = Math.round((target - protein * 4 - fat * 9) / 4);
  return { bmr, tdee, target, synthetic: true, macros: {
    calories: target, protein: { g: protein, kcal: protein * 4 },
    fat: { g: fat, kcal: fat * 9 },
    carbs: { g: carbs, kcal: carbs * 4, starchy: Math.max(0, carbs - 35), fibrous: 35 },
    vegetableCupsPerMeal: 2, vegetableCupsPerDay: Number(input.mealsPerDay ?? 4) * 2,
  } };
}

export function freshDemo(workflow: DemoWorkflow | null = null): DemoState {
  const computed = computeDemoMacros({});
  const targets = workflow === "dashboard" ? {
    calories: computed.target, protein_g: computed.macros.protein.g,
    carbs_g: computed.macros.carbs.g, fat_g: computed.macros.fat.g,
    fibrousCarbs_g: 35, starchyCarbs_g: computed.macros.carbs.starchy, mealsPerDay: 4,
  } : null;
  const user: DemoState["user"] = {
    id: "demo-studio-user", email: "demo@myperfectmeals.invalid", username: "demo-user",
    firstName: "Demo", lastName: "User", name: "Demo User", role: "client",
    isAdmin: false, isFounder: false, isSandbox: false, isTester: false,
    professionalRole: null, isProCare: false, entitlements: ["FULL_ACCESS"],
    planLookupKey: "mpm_ultimate_monthly", accessTier: "PAID_FULL",
    subscriptionStatus: "active", plan: "ultimate", subscriptionPlan: "ultimate",
    age: 42, height: 178, weight: 86.18, sex: "male", activityLevel: "moderate",
    fitnessGoal: "maintenance", goalType: "maintain", measurementSystem: "imperial",
    countryCode: "US", cuisinePreference: "American", dietaryRestrictions: [],
    allergies: [], medicalConditions: [], healthConditions: [], specialtyConditions: [],
    avoidedFoods: [], likedFoods: [], dislikedFoods: [], preferredBuilder: "general_nutrition",
    selectedMealBuilder: "general_nutrition", timezone: "America/Chicago",
    onboardingCompletedAt: workflow === "onboarding" || workflow === null ? null : new Date().toISOString(),
    hasSavedMacroProfile: !!targets, hasStudioMembership: false, studioMembership: null,
    dailyCalorieTarget: targets?.calories ?? null, dailyProteinTarget: targets?.protein_g ?? null,
    dailyCarbsTarget: targets?.carbs_g ?? null, dailyFatTarget: targets?.fat_g ?? null,
  };
  const state: DemoState = { version: 1, user, targets, workflow, path: workflowPath(workflow),
    local: targets ? { [`mpm.macroTargets.${user.id}`]: JSON.stringify(targets) } : {},
    session: { "mpm.welcomeGateDone": "true" }, bodyComposition: null, journeyStarted: !!workflow,
    navigation: { entries: [workflowPath(workflow)], index: 0 } };
  if (workflow === "macro") seedCalculatorFromProfile(state);
  return state;
}

function seedCalculatorFromProfile(state: DemoState) {
  const keys = macroCalculatorStorageKeys(state.user.id);
  if (state.local[keys.settings]) return; // Never overwrite an existing calculator draft.
  const u = state.user, cm = Number(u.height ?? 178), kg = Number(u.weight ?? 86.18);
  const inches = Math.round(cm / 2.54);
  const profileGoal = String(u.goalType ?? "maintain");
  const goal = ["lose", "loss", "lose_weight", "weight_loss"].includes(profileGoal) ? "loss"
    : ["gain", "gain_weight", "weight_gain"].includes(profileGoal) ? "gain" : "maint";
  state.local[keys.settings] = JSON.stringify({
    goal, units: u.measurementSystem ?? "imperial", sex: u.sex ?? "male",
    age: Number(u.age ?? 42), heightFt: Math.floor(inches / 12), heightIn: inches % 12,
    heightCm: cm, weightKg: kg, weightLbs: Math.round(kg / .45359237),
    activity: u.activityLevel ?? "moderate", bodyType: "meso", userType: "flexible",
    waistIn: 0, waistCm: 0,
  });
  if (state.targets && !state.session[keys.step]) state.session[keys.step] = "done";
}

export function workflowPath(workflow: DemoWorkflow | null) {
  return workflow === "onboarding" ? "/onboarding" : workflow === "macro" ? "/macro-counter" : workflow === "dashboard" ? "/dashboard" : "/";
}

export function validateDemoState(value: unknown): value is DemoState {
  try {
    const s = value as DemoState;
    assertSyntheticIdentity(s?.user);
    return s.version === 1 && ["onboarding", "macro", "dashboard", null].includes(s.workflow)
      && typeof s.path === "string" && !!demoDestination(s.path) && !!s.local && !!s.session &&
      Object.values(s.local).every(v => typeof v === "string") &&
      Object.values(s.session).every(v => typeof v === "string");
  } catch { return false; }
}

export class DemoStore {
  state: DemoState;
  listeners = new Set<() => void>();
  blocked = new Set<string>();
  revision = 0;
  constructor(state: unknown) {
    this.state = validateDemoState(state) ? structuredClone(state) : freshDemo();
    // Legacy sessions are retained, not replaced with a new returning-member seed.
    this.state.journeyStarted ??= true;
    if (!this.state.navigation || !Array.isArray(this.state.navigation.entries) ||
      !Number.isInteger(this.state.navigation.index) ||
      this.state.navigation.index < 0 ||
      this.state.navigation.index >= this.state.navigation.entries.length ||
      this.state.navigation.entries.some(p => typeof p !== "string" || !demoDestination(p))) {
      this.state.navigation = { entries: [this.state.path], index: 0 };
    }
    if (this.state.workflow === "macro") seedCalculatorFromProfile(this.state);
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  changed = () => { this.revision++; this.listeners.forEach(fn => fn()); };
  patchUser(fields: Record<string, any>) {
    // Identity and privileges are immutable, including on malformed save payloads.
    const { id, email, role, isAdmin, isFounder, professionalRole,
      isTester, isSandbox, isProCare, hasStudioMembership, studioMembership,
      operatingStatus, builderSwitchUnlimited, accessTier, planLookupKey, plan,
      subscriptionPlan, subscriptionStatus, entitlements, builderChangesUsed,
      builderChangeLimit, ...profile } = fields;
    if ("firstName" in profile || "lastName" in profile) {
      profile.name = `${profile.firstName ?? this.state.user.firstName ?? ""} ${profile.lastName ?? this.state.user.lastName ?? ""}`.trim();
    }
    this.state = { ...this.state, journeyStarted: true, user: { ...this.state.user, ...profile } };
    assertSyntheticIdentity(this.state.user); this.changed();
  }
  navigate = (input: string, options?: { replace?: boolean }) => {
    if (input.startsWith("https://demo.invalid/")) input = input.slice("https://demo.invalid".length);
    const path = demoDestination(input, this.state.path);
    if (!path) { this.blocked.add(blockedDestination(input)); this.changed(); return; }
    const clean = path.split(/[?#]/)[0];
    const workflow: DemoWorkflow | null = clean === "/" ? null
      : clean.startsWith("/onboarding") ? "onboarding" : clean === "/macro-counter" ? "macro" : "dashboard";
    const history = this.state.navigation ?? { entries: [this.state.path], index: 0 };
    const entries = history.entries.slice(0, history.index + 1);
    if (options?.replace) entries[entries.length - 1] = path;
    else if (entries[entries.length - 1] !== path) entries.push(path);
    this.state = { ...this.state, workflow, path, journeyStarted: true,
      navigation: { entries, index: entries.length - 1 } };
    if (workflow === "macro") seedCalculatorFromProfile(this.state);
    this.changed();
  };
  travel = (delta: number) => {
    const h = this.state.navigation;
    if (!h || !Number.isInteger(delta)) return;
    const index = h.index + delta;
    if (index < 0 || index >= h.entries.length || index === h.index) return;
    const destination = h.entries[index];
    if (!demoDestination(destination)) { this.blocked.add(blockedDestination(destination)); this.changed(); return; }
    const clean = destination.split(/[?#]/)[0];
    this.state = { ...this.state, path: destination, workflow: clean === "/" ? null
      : clean.startsWith("/onboarding") ? "onboarding" : clean === "/macro-counter" ? "macro" : "dashboard",
      navigation: { ...h, index } };
    if (this.state.workflow === "macro") seedCalculatorFromProfile(this.state);
    this.changed();
  };
  enter = () => {
    if (!this.state.journeyStarted) this.reset("dashboard");
    else this.navigate("/dashboard");
  };
  reset(workflow: DemoWorkflow | null) { this.state = freshDemo(workflow); this.blocked.clear(); this.changed(); }
}
