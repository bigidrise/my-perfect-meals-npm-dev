// client/src/lib/auth.ts
import { apiUrl } from '@/lib/resolveApiBase';
import { Capacitor } from '@capacitor/core';

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

export type UserRole = "admin" | "coach" | "client";

export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  entitlements?: string[];
  planLookupKey?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  selectedMealBuilder?: MealBuilderType | null;
  isTester?: boolean;
  profilePhotoUrl?: string | null;
  // Role-based access control
  role?: UserRole;
  isProCare?: boolean;
  activeBoard?: MealBuilderType | null;
  // Onboarding completion - CRITICAL for enforcing onboarding gate
  onboardingCompletedAt?: string | null;
  // Profile data from onboarding (used by Edit Profile)
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  activityLevel?: string | null;
  fitnessGoal?: string | null;
  allergies?: string[];
  dietaryRestrictions?: string[];
  // Display preferences
  fontSizePreference?: "standard" | "large" | "xl";
  // ProCare Professional fields
  professionalRole?: "trainer" | "physician" | null;
  professionalCategory?: "certified" | "experienced" | "non_certified" | null;
  credentialType?: string | null;
  credentialBody?: string | null;
  credentialNumber?: string | null;
  credentialYear?: string | null;
  attestationText?: string | null;
  procareEntryPath?: string | null;
  attestedAt?: string | null;
  studioMembership?: {
    studioId: string;
    studioName: string | null;
    studioType: string | null;
    membershipId: string;
    ownerUserId: string | null;
    status?: string;
    assignedBuilder?: string | null;
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

export function isOnTrial(user: User | null): boolean {
  if (!user) return false;
  if (user.isTester) return true;
  if (!user.trialEndsAt) return false;
  return new Date(user.trialEndsAt) > new Date();
}

export function getTrialDaysRemaining(user: User | null): number {
  if (!user) return 0;
  if (user.isTester) return 999;
  if (!user.trialEndsAt) return 0;
  const endDate = new Date(user.trialEndsAt);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
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
  const attestationText = localStorage.getItem("procare_attestation_text");
  const attestedAt = localStorage.getItem("procare_attested_at");
  const entryPath = localStorage.getItem("procare_entry_path");

  if (!role || !category || !attestationText || !attestedAt || !entryPath) return null;

  return {
    professionalRole: role,
    professionalCategory: category,
    credentialType: localStorage.getItem("procare_credential_type") || undefined,
    credentialBody: localStorage.getItem("procare_credential_body") || undefined,
    credentialNumber: localStorage.getItem("procare_credential_number") || undefined,
    credentialYear: localStorage.getItem("procare_credential_year") || undefined,
    attestationText,
    attestedAt,
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

export async function signUp(email: string, password: string, procareData?: ProCareSignupData | null): Promise<User> {
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
      body: JSON.stringify({ email, password, ...(procareData ? { procare: procareData } : {}) }),
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

    console.log("✅ NEW user created and saved:", user.email, "ID:", user.id);

    return user;
  } catch (error: any) {
    console.error("Signup failed:", error);
    throw error;
  }
}

export async function login(email: string, password: string): Promise<User> {
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
    };

    localStorage.setItem("mpm_current_user", JSON.stringify(user));
    localStorage.setItem("userId", user.id);
    localStorage.setItem("isAuthenticated", "true");

    console.log("✅ User logged in:", user.email, "ID:", user.id, "isProCare:", user.isProCare, "role:", user.professionalRole, "studioMembership:", !!user.studioMembership);

    return user;
  } catch (error: any) {
    console.error("Login failed:", error);
    throw error;
  }
}

export function logout(): void {
  clearAuthToken();
  localStorage.removeItem("mpm_current_user");
  localStorage.removeItem("userId");
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("coachMode");
  localStorage.removeItem("mpm.hasSeenWelcome");
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem("mpm_current_user");
  return userStr ? JSON.parse(userStr) : null;
}