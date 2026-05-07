import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";

import { User, getCurrentUser, getAuthHeaders, getAuthToken, clearAuthToken } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { isGuestMode, getGuestSession } from "@/lib/guestMode";
import { setUserContext, clearUserContext } from "@/lib/sentry";

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = getAuthToken();
    if (!token) {
      console.log("⚠️ [AuthContext] No token - skipping refresh");
      return null;
    }

    try {
      console.log("📡 [AuthContext] Refreshing user...");
      const response = await fetch(apiUrl(`/api/user/profile`), {
        headers: { ...getAuthHeaders() },
      });

      if (response.ok) {
        const userData = await response.json();
        const updatedUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.username || userData.firstName,
          entitlements: userData.entitlements || [],
          planLookupKey: userData.planLookupKey,
          trialStartedAt: userData.trialStartedAt,
          trialEndsAt: userData.trialEndsAt,
          selectedMealBuilder: userData.selectedMealBuilder,
          isTester: userData.isTester || false,
          accessTier: userData.accessTier || "FREE",
          trialDaysRemaining: userData.trialDaysRemaining ?? null,
          hasHadTrial: userData.hasHadTrial || false,
          profilePhotoUrl: userData.profilePhotoUrl || null,
          role: userData.role || "client",
          isProCare: userData.isProCare || false,
          activeBoard: userData.activeBoard || null,
          builderSwitchUnlimited: userData.builderSwitchUnlimited || false,
          onboardingCompletedAt: userData.onboardingCompletedAt || null,
          firstName: userData.firstName || null,
          lastName: userData.lastName || null,
          nickname: userData.nickname || null,
          professionalCategory: userData.professionalCategory || null,
          credentialType: userData.credentialType || null,
          credentialBody: userData.credentialBody || null,
          credentialNumber: userData.credentialNumber || null,
          credentialYear: userData.credentialYear || null,
          attestationText: userData.attestationText || null,
          professionalRole: userData.professionalRole || null,
          procareEntryPath: userData.procareEntryPath || null,
          attestedAt: userData.attestedAt || null,
          age: userData.age || null,
          height: userData.height || null,
          weight: userData.weight || null,
          activityLevel: userData.activityLevel || null,
          fitnessGoal: userData.fitnessGoal || null,
          allergies: userData.allergies || [],
          dietaryRestrictions: userData.dietaryRestrictions || [],
          fontSizePreference: userData.fontSizePreference || "standard",
          medicalConditions: userData.medicalConditions || [],
          preferredBuilder: userData.preferredBuilder || null,
          flavorPreference: userData.flavorPreference || null,
          heatPreference: userData.heatPreference || null,
          sweetenerPreferences: userData.sweetenerPreferences || [],
          palateSpiceTolerance: userData.palateSpiceTolerance || null,
          palateSeasoningIntensity: userData.palateSeasoningIntensity || null,
          palateFlavorStyle: userData.palateFlavorStyle || null,
          avoidedFoods: userData.avoidedFoods || [],
          goalType: userData.goalType ?? null,
          goalTarget: userData.goalTarget ?? null,
          goalTimelineWeeks: userData.goalTimelineWeeks ?? null,
          goalStartDate: userData.goalStartDate ?? null,
          hasAllergyPin: userData.hasAllergyPin || false,
          studioMembership: userData.studioMembership || null,
          dailyCalorieTarget: userData.dailyCalorieTarget ?? null,
          dailyProteinTarget: userData.dailyProteinTarget ?? null,
          dailyCarbsTarget: userData.dailyCarbsTarget ?? null,
          dailyFatTarget: userData.dailyFatTarget ?? null,
          oncologySupportIntent: userData.oncologySupportIntent ?? null,
          specialtyCondition: userData.specialtyCondition ?? null,
          oncologySupportContext: userData.oncologySupportContext ?? null,
          activeSystem: userData.activeSystem || null,
          isCreator: userData.isCreator || false,
          creatorDisplayName: userData.creatorDisplayName || null,
          cuisinePreference: userData.cuisinePreference || null,
          cuisineIntensity: userData.cuisineIntensity || null,
          isAdmin: userData.isAdmin || false,
        };
        if (userData.oncologySupportIntent) {
          localStorage.setItem("mpm:oncologySupportIntent", userData.oncologySupportIntent);
        } else {
          localStorage.removeItem("mpm:oncologySupportIntent");
        }
        setUser(updatedUser);
        localStorage.setItem("mpm_current_user", JSON.stringify(updatedUser));
        setUserContext(String(updatedUser.id), updatedUser.email);
        console.log("✅ [AuthContext] User refreshed:", updatedUser.email);
        return updatedUser;
      } else if (response.status === 401 || response.status === 403) {
        // Definitive auth rejection — token is invalid or revoked
        console.warn("⚠️ [AuthContext] Refresh rejected (auth):", response.status);
        return null;
      } else {
        // Transient server error (5xx) or unexpected status — do NOT sign out.
        // Preserve the cached user so the app keeps working through brief outages.
        console.warn(
          "⚠️ [AuthContext] Refresh failed with transient status:",
          response.status,
          "— keeping cached user",
        );
        throw new Error(`transient:${response.status}`);
      }
    } catch (error: any) {
      if (error?.message?.startsWith("transient:")) throw error;
      // Network-level failure (fetch threw) — also transient, do NOT sign out
      console.error("❌ [AuthContext] Refresh network error — keeping cached user:", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    const handleUserUpdated = () => {
      console.log("📡 [AuthContext] mpm:user-updated received — refreshing");
      refreshUser().catch(() => {});
    };
    window.addEventListener("mpm:user-updated", handleUserUpdated);
    return () => window.removeEventListener("mpm:user-updated", handleUserUpdated);
  }, [refreshUser]);

  // On app resume (tab becomes visible after being hidden), re-probe the session
  // if it has been more than 5 minutes since the last successful refresh.
  // A 401 from the probe means the token was revoked while the app was in background.
  useEffect(() => {
    let lastProbeTime = Date.now();
    const PROBE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    const handleVisibilityResumed = async () => {
      if (Date.now() - lastProbeTime < PROBE_INTERVAL_MS) return;
      const token = getAuthToken();
      if (!token) return;

      lastProbeTime = Date.now();
      try {
        const res = await fetch(apiUrl("/api/auth/session"), {
          headers: { ...getAuthHeaders() },
        });
        if (res.status === 401 || res.status === 403) {
          console.warn("⚠️ [AuthContext] Session probe on resume → 401 — signing out");
          setUser(null);
          localStorage.removeItem("mpm_current_user");
          localStorage.removeItem("userId");
          localStorage.removeItem("isAuthenticated");
          clearAuthToken();
          clearUserContext();
          window.location.href = "/login";
        }
      } catch {
        // Network error on probe — app may be offline, keep session
      }
    };

    window.addEventListener("mpm:visibility-resumed", handleVisibilityResumed);
    return () => window.removeEventListener("mpm:visibility-resumed", handleVisibilityResumed);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const currentUser = getCurrentUser();
      const token = getAuthToken();
      const appleReviewFullAccess =
        localStorage.getItem("appleReviewFullAccess") === "true";

      if (token && currentUser && !currentUser.id.startsWith("guest-")) {
        setUser(currentUser);
        try {
          const freshUser = await refreshUser();
          if (!freshUser) {
            // null = definitive 401/403: token is revoked — sign out
            console.log("⚠️ [AuthContext] Token rejected by server — signing out");
            setUser(null);
            localStorage.removeItem("mpm_current_user");
            localStorage.removeItem("userId");
            localStorage.removeItem("isAuthenticated");
            clearAuthToken();
            clearUserContext();
            if (window.location.pathname !== "/login" && window.location.pathname !== "/welcome") {
              window.location.href = "/login";
            }
          }
        } catch {
          // Transient error (5xx / network) — keep cached user; the app stays usable
          console.warn("⚠️ [AuthContext] Transient refresh error on mount — using cached user");
        }
      } else if (appleReviewFullAccess) {
        const demoUser: User = {
          id: "00000000-0000-0000-0000-000000000001",
          email: "reviewer@apple.com",
          name: "Apple Reviewer",
          entitlements: ["FULL_ACCESS"],
          planLookupKey: "premium",
          trialStartedAt: null,
          trialEndsAt: null,
          selectedMealBuilder: "weekly",
          isTester: true,
          profilePhotoUrl: null,
          role: "admin",
          isProCare: false,
          activeBoard: "weekly",
          onboardingCompletedAt: new Date().toISOString(),
        };
        setUser(demoUser);
        localStorage.setItem("mpm_current_user", JSON.stringify(demoUser));
      } else if (isGuestMode()) {
        const guestSession = getGuestSession();
        const guestUser: User = {
          id: guestSession?.sessionId || `guest-${Date.now()}`,
          email: "guest@myperfectmeals.com",
          name: "Guest",
          entitlements: ["GUEST_ACCESS"],
          planLookupKey: null,
          trialStartedAt: null,
          trialEndsAt: null,
          selectedMealBuilder: "weekly",
          isTester: false,
          profilePhotoUrl: null,
          role: "client",
          isProCare: false,
          activeBoard: "weekly",
        };
        setUser(guestUser);
      } else {
        console.log("⚠️ [AuthContext] No valid auth - clearing state");
        setUser(null);
        localStorage.removeItem("mpm_current_user");
        localStorage.removeItem("userId");
        localStorage.removeItem("isAuthenticated");
        clearAuthToken();
        clearUserContext();
        const publicPaths = ["/login", "/welcome", "/auth", "/forgot-password", "/reset-password", "/pricing", "/privacy", "/guest-builder", "/guest-suite", "/consumer-welcome", "/procare-welcome", "/procare-identity", "/procare-attestation", "/founders", "/affiliates", "/delete-account", "/terms", "/privacy-policy"];
        const isPublicPath = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + "/"));
        if (!isPublicPath) {
          window.location.href = "/welcome";
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
