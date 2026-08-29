// client/src/lib/auth.ts
import { apiUrl } from '@/lib/resolveApiBase';
import { Capacitor } from '@capacitor/core';
import { clearNutritionCache } from '../hooks/nutritionStateCache';

export type MealBuilderType = "weekly" | "diabetic" | "glp1" | "anti_inflammatory" | "beach_body" | "general_nutrition" | "performance_competition";

// APP STORE REVIEW: Demo credentials for Apple reviewers
// These are prefilled in the login form on native builds for convenience
// Reviewers still go through normal login flow (Apple-approved approach)
export const DEMO_CREDENTIALS = {
  email: "demo@myperfectmeals.com",
  password: "Demo2024!"
};

// Check if running on native platform (iOS/Android)
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// For video recording: Quick auto-login mode (set to false for App Store submission)
const AUTO_LOGIN_FOR_VIDEO = false;

const DEMO_USER: User = {
  id: "demo-ios-user",
  email: "demo@myperfectmeals.com",
  name: "Demo User",
  entitlements: ["pro", "all_features"],
  planLookupKey: "pro_monthly",
  isTester: true,
};

export function initNativeDemoMode(): boolean {
  if (!AUTO_LOGIN_FOR_VIDEO) return false;
  // Skip Capacitor check - auto-login for video recording on any platform
  
  console.log("📱 Demo mode: Auto-logging in demo user for video recording");
  
  localStorage.setItem("mpm_current_user", JSON.stringify(DEMO_USER));
  localStorage.setItem("userId", DEMO_USER.id);
  localStorage.setItem("isAuthenticated", "true");
  localStorage.setItem("mpm_auth_token", "demo-token-ios-preview");
  
  return true;
}

const AUTH_TOKEN_KEY = "mpm_auth_token";

export type UserRole = "admin" | "coach" | "client" | "trainer" | "physician";

export type AccessTier = "PAID_FULL" | "FREE";

export interface User {
  id: string;

  email: string;

  name?: string;

  username?: string;

  entitlements?: string[];

  planLookupKey?: string | null;

  selectedMealBuilder?: MealBuilderType | null;

  isTester?: boolean;
  isSandbox?: boolean;

  accessTier?: AccessTier;

  profilePhotoUrl?: string | null;
  // Role-based access control

  role?: UserRole;

  isProCare?: boolean;

  activeBoard?: MealBuilderType | null;

  builderSwitchUnlimited?: boolean;
  // Onboarding completion - CRITICAL for enforcing onboarding gate

  onboardingCompletedAt?: string | null;
  // Profile data from onboarding (used by Edit Profile)

  firstName?: string | null;

  lastName?: string | null;

  nickname?: string | null;

  timezone?: string | null;

  timezoneUpdatedAt?: string | null;

  age?: number | null;

  height?: number | null;

  weight?: number | null;

  activityLevel?: string | null;

  fitnessGoal?: string | null;

  allergies?: string[];

  dietaryRestrictions?: string[];
  // Onboarding V2 fields

  medicalConditions?: string[];

  healthConditions?: string[];

  preferredBuilder?: string | null;

  flavorPreference?: string | null;

  heatPreference?: string | null;

  sweetenerPreferences?: string[];

  palateSpiceTolerance?: string | null;

  palateSeasoningIntensity?: string | null;

  palateFlavorStyle?: string | null;

  avoidedFoods?: string[];

  alphaGalProfile?: {
    diagnosisStatus: "diagnosed" | "being_evaluated" | "no";
    dairyTolerance: "yes" | "no" | "unsure";
    gelatinRestriction: "yes" | "no" | "unsure";
    severeReactionHistory: "yes" | "no" | "unsure";
    profileComplete: boolean;
    activatedAt: string | null;
    updatedAt: string | null;
  } | null;

  hasAllergyPin?: boolean;
  // Macro targets (from DB — survive reinstall)

  dailyCalorieTarget?: number | null;

  dailyProteinTarget?: number | null;

  dailyCarbsTarget?: number | null;

  dailyFatTarget?: number | null;
  // Display preferences

  fontSizePreference?: "standard" | "large" | "xl";

  narrationSpeedPreference?: "0.75" | "1.0" | "1.25" | "1.5";
  // ProCare Professional fields

  professionalRole?: "trainer" | "physician" | "dietitian" | "nurse_practitioner" | "business" | null;

  professionalCategory?: "certified" | "experienced" | "non_certified" | null;

  credentialType?: string | null;

  credentialBody?: string | null;

  credentialNumber?: string | null;

  credentialYear?: string | null;

  attestationText?: string | null;

  procareEntryPath?: string | null;

  attestedAt?: string | null;

  procareTrainingCompleted?: boolean;

  phase2GateEnabled?: boolean;

  /** Server-computed: user holds an active ProCare subscription (not inferred from cert). */
  proCareEligible?: boolean;

  /** Server-computed: user holds Pro or higher subscription (affiliate/monetization gate). */
  monetizationEligible?: boolean;

  studioMembership?: {
    studioId: string;
    studioName: string | null;
    studioType: string | null;
    membershipId: string;
    ownerUserId: string | null;
    status?: string;
    assignedBuilder?: string | null;

  } | null;

  goalType?: "lose" | "maintain" | "gain" | null;

  goalTarget?: string | null;

  goalTimelineWeeks?: number | null;

  goalStartDate?: string | null;
  // Professional availability fields

  availabilityStatus?: "available" | "busy" | "away" | "offline" | null;

  backAt?: string | null;
  // Oncology support onboarding intent (NOT a clinical protocol toggle)

  oncologySupportIntent?: "own_provider" | "request_support" | "self_directed" | null;
  // Self-selected specialty health protocol (edit profile page)

  specialtyCondition?: string | null;

  specialtyConditions?: string[];
  // Thyroid subtype — "hypothyroid" | "hyperthyroid" | "hashimotos"

  thyroidType?: "hypothyroid" | "hyperthyroid" | "hashimotos" | null;
  // Thyroid Support — medication name if disclosed (e.g. "Levothyroxine")

  thyroidMedication?: string | null;
  // Physician-set oncology context (Protocol Ownership Model)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  oncologySupportContext?: any | null;
  // Creator Studio

  activeSystem?: string | null;

  isCreator?: boolean;

  creatorDisplayName?: string | null;
  // Starch preferences — persisted via PATCH /api/prescription/starch-preferences

  defaultStarchMealsPerDay?: number | null;

  starchDistributionStrategy?: "even" | "workout" | "morning" | "evening" | "ai" | null;
  // Clinical Context Screening — self-reported medication/hormone gate

  clinicalContextResponse?: "yes" | "no" | "unsure" | null;

  clinicalContextCategories?: string[] | null;
  /** Conditions inferred from clinical laboratory results by the server. */
  labDrivenConditions?: string[];
  /** True when a physician owns the user's active clinical protocol. */
  physicianLocked?: boolean;
  // Culture Intelligence

  cuisinePreference?: string | null;

  cuisineIntensity?: string | null;
  // Admin access

  isAdmin?: boolean;
  // International / Metric Support

  measurementSystem?: "imperial" | "metric";

  countryCode?: "US" | "CA" | "AU" | "UK" | "NZ";
  // Language Preference

  preferredLanguage?: string;
  // Pregnancy Support

  pregnancyStage?: string | null;

  pregnancyDueDate?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  pregnancySupportContext?: any | null;
  // Performance Nutrition Protocol
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  performanceContext?: any | null;

  competitionPrepContext?: any | null;

  activeProtocolTrack?: "athletic" | "competition" | null;

  weeklyTrainingSchedule?: any | null;
  performanceModeEnabled?: boolean;

  performanceProtocolConfig?: any | null;
  // Multi-factor authentication

  mfaEnabled?: boolean;
  // Trial access window
  trialEndsAt?: string | null;
  /** ISO timestamp when the trial began */
  trialStartedAt?: string | null;
  /** standard_signup | admin_grant | clinic_grant | promotion | pilot_program | client_access */
  trialSource?: string | null;
  /** Reporting category for pre-registered 30-day access */
  trialAccessType?: "pilot" | "client" | null;
  /** True when trialEndsAt is in the future and no paid plan is active */
  isTrialActive?: boolean;
  /** Server-computed days remaining (0 when expired or not in trial) */
  daysRemaining?: number;
  /** The tier the trial grants (e.g. 'ultimate') — null when not in trial */
  trialTier?: string | null;
  // Business sponsorship (populated from effectiveAccess per-request)

  sponsoredByBusinessId?: string | null;

  sponsoredByBusinessName?: string | null;

  recentlyRemovedFromBusiness?: {
    businessId: string;
    businessName: string;
    removedAt: string;
  } | null;
  // Client invitation access — populated when this user accepted a client invitation
  activeClientAccess?: {
    programName: string | null;
    businessName: string;
    inviterName: string | null;
    trialDays: number | null;
    acceptedAt: string;
  } | null;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { "x-auth-token": token } : {};
}

// API-based authentication with database persistence
export interface ProCareSignupData {
  professionalRole: "trainer" | "physician";
  professionalCategory: "certified" | "experienced" | "non_certified";
  credentialType?: string;
  credentialBody?: string;
  credentialNumber?: string;
  credentialYear?: string;
  attestationText: string;
  attestedAt: string;
  procareEntryPath: string;
}

export function getProCareSignupData(): ProCareSignupData | null {
  const role = localStorage.getItem("procare_role") as ProCareSignupData["professionalRole"] | null;
  const category = localStorage.getItem("procare_category") as ProCareSignupData["professionalCategory"] | null;
  const entryPath = localStorage.getItem("procare_entry_path");

  if (!role || !category || !entryPath) return null;

  return {
    professionalRole: role,
    professionalCategory: category,
    credentialType: localStorage.getItem("procare_credential_type") || undefined,
    credentialBody: localStorage.getItem("procare_credential_body") || undefined,
    credentialNumber: localStorage.getItem("procare_credential_number") || undefined,
    credentialYear: localStorage.getItem("procare_credential_year") || undefined,
    attestationText: "Accepted via legal document system",
    attestedAt: new Date().toISOString(),
    procareEntryPath: entryPath,
  };
}

export function clearProCareSignupData() {
  const keys = [
    "procare_role", "procare_category", "procare_credential_type", "procare_credential_body",
    "procare_credential_number", "procare_credential_year", "procare_attestation_text",
    "procare_attestation_version", "procare_attested_at", "procare_entry_path",
  ];
  keys.forEach((k) => localStorage.removeItem(k));
}

export async function upgradeToProCare(procareData: ProCareSignupData): Promise<any> {
  const res = await fetch(apiUrl("/api/auth/upgrade-to-procare"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ procare: procareData }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to upgrade account");
  }
  return res.json();
}

export async function signUp(email: string, password: string, procareData?: ProCareSignupData | null, businessAccount?: boolean, signupSource?: string | null): Promise<User> {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  // CRITICAL: Clear ANY existing auth state before signup to prevent identity leakage
  // This prevents iOS Keychain token reuse from causing cross-account data sharing
  console.log("🔐 [Signup] Clearing all existing auth state before creating new account");
  clearAuthToken();
  localStorage.removeItem("mpm_current_user");
  localStorage.removeItem("userId");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("coachMode");
  localStorage.removeItem("onboardingCompleted");
  localStorage.removeItem("completedProfile");
  localStorage.removeItem("onboardingData");
  localStorage.removeItem("selectedBuilder");

  try {
    const response = await fetch(apiUrl("/api/auth/signup"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, ...(procareData ? { procare: procareData } : {}), ...(businessAccount ? { businessAccount: true } : {}), ...(signupSource ? { signupSource } : {}) }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create account");
    }

    const userData = await response.json();
    
    // Store FRESH auth token from server response
    if (userData.authToken) {
      setAuthToken(userData.authToken);
    }
    
    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.username,
      // New accounts have NO onboarding completion
      onboardingCompletedAt: null,
    };

    // Save to localStorage for offline access
    localStorage.setItem("mpm_current_user", JSON.stringify(user));
    localStorage.setItem("userId", user.id);
    localStorage.setItem("isAuthenticated", "true");

    console.log("✅ NEW user created and saved");

    return user;
  } catch (error: any) {
    console.error("Signup failed:", error);
    throw error;
  }
}

export async function login(
  email: string,
  password: string
): Promise<User | { mfaRequired: true }> {
  try {
    const response = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to login");
    }

    const userData = await response.json();

    // MFA gate — server has stored pendingMfaUserId in session
    if (userData.mfaRequired === true) {
      return { mfaRequired: true };
    }

    // Store auth token from server response
    if (userData.authToken) {
      setAuthToken(userData.authToken);
    }

    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.username,
      isProCare: userData.isProCare || false,
      professionalRole: userData.professionalRole || null,
      role: userData.role || "client",
      selectedMealBuilder: userData.selectedMealBuilder || null,
      activeBoard: userData.activeBoard || null,
      onboardingCompletedAt: userData.onboardingCompletedAt || null,
      studioMembership: userData.studioMembership || null,
      mfaEnabled: userData.mfaEnabled || false,
    };

    localStorage.setItem("mpm_current_user", JSON.stringify(user));
    localStorage.setItem("userId", user.id);
    localStorage.setItem("isAuthenticated", "true");

    // Apple Review mode: when the reviewer logs in with the demo account,
    // flag the session so the app bypasses paywalls and gating for review.
    if (email.toLowerCase().trim() === "demo@myperfectmeals.com") {
      localStorage.setItem("appleReviewFullAccess", "true");
      console.log("🍎 [Auth] Apple review mode enabled");
    } else {
      localStorage.removeItem("appleReviewFullAccess");
    }

    console.log("✅ User logged in — isProCare:", user.isProCare, "role:", user.professionalRole);

    return user;
  } catch (error: any) {
    console.error("Login failed:", error);
    throw error;
  }
}

/**
 * Complete an MFA challenge after login.
 * The session must have pendingMfaUserId set (done by the login endpoint).
 */
export async function completeMfaChallenge(
  code: string,
  isBackup = false
): Promise<User> {
  const endpoint = isBackup
    ? "/api/auth/mfa/challenge/backup"
    : "/api/auth/mfa/challenge";

  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "MFA verification failed");
  }

  const userData = await response.json();

  if (userData.authToken) {
    setAuthToken(userData.authToken);
  }

  const user: User = {
    id: userData.id,
    email: userData.email,
    name: userData.username,
    isProCare: userData.isProCare || false,
    professionalRole: userData.professionalRole || null,
    role: userData.role || "client",
    selectedMealBuilder: userData.selectedMealBuilder || null,
    activeBoard: userData.activeBoard || null,
    onboardingCompletedAt: userData.onboardingCompletedAt || null,
    studioMembership: userData.studioMembership || null,
    mfaEnabled: userData.mfaEnabled || false,
  };

  localStorage.setItem("mpm_current_user", JSON.stringify(user));
  localStorage.setItem("userId", user.id);
  localStorage.setItem("isAuthenticated", "true");

  return user;
}

export function logout(): void {
  // Fire-and-forget server-side token invalidation. The token is cleared from
  // localStorage immediately below regardless of whether the server call succeeds,
  // so logout is instant from the user's perspective.
  const token = getAuthToken();
  if (token) {
    fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers: { "x-auth-token": token },
    }).catch(() => {});
  }

  clearAuthToken();
  localStorage.removeItem("mpm_current_user");
  localStorage.removeItem("userId");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("coachMode");
  localStorage.removeItem("mpm.hasSeenWelcome");
  clearNutritionCache();
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem("mpm_current_user");
  return userStr ? JSON.parse(userStr) : null;
}
