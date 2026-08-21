import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";

import { User, getCurrentUser, getAuthHeaders, getAuthToken, clearAuthToken } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import i18n, { resolveI18nLang } from "@/i18n";
import { isGuestMode, getGuestSession } from "@/lib/guestMode";
import { setUserContext, clearUserContext } from "@/lib/sentry";
import { clearNutritionCache } from "@/hooks/nutritionStateCache";

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

function WakingUpScreen() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(135deg, #000 0%, #1a0a00 50%, #000 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "20px",
    }}>
      <img src="/icons/chef.png?v=2026b" alt="Loading" style={{ width: "80px", height: "80px" }} />
      <p style={{ color: "#f97316", fontSize: "16px", fontWeight: 600, margin: 0 }}>
        Waking up your meal engine…
      </p>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", margin: 0, textAlign: "center", maxWidth: "260px" }}>
        First load takes a few extra seconds. Hang tight!
      </p>
    </div>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSlowStart, setIsSlowStart] = useState(false);
  const slowStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFinishedInitialLoad = useRef(false);

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
        credentials: "include",
        cache: "no-store",
      });

      if (response.ok) {
        const userData = await response.json();
        const updatedUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.username || userData.firstName,
          entitlements: userData.entitlements || [],
          planLookupKey: userData.planLookupKey,
          selectedMealBuilder: userData.selectedMealBuilder,
          isTester: userData.isTester || false,
          accessTier: userData.accessTier || "FREE",
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
          procareTrainingCompleted: userData.procareTrainingCompleted || false,
          phase2GateEnabled: userData.phase2GateEnabled || false,
          proCareEligible: userData.proCareEligible ?? false,
          monetizationEligible: userData.monetizationEligible ?? false,
          age: userData.age || null,
          height: userData.height || null,
          weight: userData.weight || null,
          activityLevel: userData.activityLevel || null,
          fitnessGoal: userData.fitnessGoal || null,
          allergies: userData.allergies || [],
          dietaryRestrictions: userData.dietaryRestrictions || [],
          fontSizePreference: userData.fontSizePreference || "standard",
          narrationSpeedPreference: userData.narrationSpeedPreference || "1.0",
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
          specialtyConditions: (userData.specialtyConditions as string[]) ?? [],
          labDrivenConditions: (userData.labDrivenConditions as string[]) ?? [],
          physicianLocked: userData.physicianLocked ?? false,
          thyroidMedication: userData.thyroidMedication ?? null,
          oncologySupportContext: userData.oncologySupportContext ?? null,
          alphaGalProfile: (userData as any).alphaGalProfile ?? null,
          activeSystem: userData.activeSystem || null,
          isCreator: userData.isCreator || false,
          creatorDisplayName: userData.creatorDisplayName || null,
          defaultStarchMealsPerDay: userData.defaultStarchMealsPerDay ?? null,
          starchDistributionStrategy: userData.starchDistributionStrategy ?? null,
          clinicalContextResponse: userData.clinicalContextResponse ?? null,
          clinicalContextCategories: (userData.clinicalContextCategories as string[]) ?? [],
          cuisinePreference: userData.cuisinePreference || null,
          cuisineIntensity: userData.cuisineIntensity || null,
          isAdmin: userData.isAdmin || false,
          availabilityStatus: userData.availabilityStatus ?? null,
          backAt: userData.backAt ?? null,
          measurementSystem: userData.measurementSystem || "imperial",
          countryCode: userData.countryCode || "US",
          preferredLanguage: userData.preferredLanguage || "auto",
          pregnancyStage: userData.pregnancyStage ?? null,
          pregnancyDueDate: userData.pregnancyDueDate ?? null,
          pregnancySupportContext: userData.pregnancySupportContext ?? null,
          performanceContext: userData.performanceContext ?? null,
          competitionPrepContext: userData.competitionPrepContext ?? null,
          activeProtocolTrack: userData.activeProtocolTrack ?? null,
          weeklyTrainingSchedule: userData.weeklyTrainingSchedule ?? null,
          performanceProtocolConfig: userData.performanceProtocolConfig ?? null,
          performanceModeEnabled: (userData as any).performanceModeEnabled ?? false,
          trialEndsAt: userData.trialEndsAt ?? null,
          trialStartedAt: (userData as any).trialStartedAt ?? null,
          trialSource: (userData as any).trialSource ?? null,
          isTrialActive: (userData as any).isTrialActive ?? false,
          daysRemaining: (userData as any).daysRemaining ?? 0,
          trialTier: (userData as any).trialTier ?? null,
          sponsoredByBusinessId: userData.sponsoredByBusinessId ?? null,
          sponsoredByBusinessName: userData.sponsoredByBusinessName ?? null,
          recentlyRemovedFromBusiness: userData.recentlyRemovedFromBusiness ?? null,
          activeClientAccess: userData.activeClientAccess ?? null,
        };
        if (userData.weeklyTrainingSchedule && userData.performanceProtocolConfig) {
          const uid = String(updatedUser.id);
          localStorage.setItem(`mpm.perfProtocol.${uid}`, JSON.stringify({
            schedule: userData.weeklyTrainingSchedule,
            config: userData.performanceProtocolConfig,
            enabled: (userData as any).performanceModeEnabled ?? false,
          }));
        }
        if (userData.oncologySupportIntent) {
          localStorage.setItem("mpm:oncologySupportIntent", userData.oncologySupportIntent);
        } else {
          localStorage.removeItem("mpm:oncologySupportIntent");
        }
        setUser(updatedUser);
        localStorage.setItem("mpm_current_user", JSON.stringify(updatedUser));
        setUserContext(String(updatedUser.id), updatedUser.email);
        console.log("✅ [AuthContext] User refreshed");
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

  // Show "Waking up…" screen if initial auth check takes > 2 seconds.
  // Only fires once on mount — not on subsequent refreshes.
  useEffect(() => {
    slowStartTimerRef.current = setTimeout(() => {
      if (!hasFinishedInitialLoad.current) {
        setIsSlowStart(true);
      }
    }, 2000);
    return () => {
      if (slowStartTimerRef.current) clearTimeout(slowStartTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleUserUpdated = () => {
      console.log("📡 [AuthContext] mpm:user-updated received — refreshing");
      refreshUser().catch(() => {});
    };
    window.addEventListener("mpm:user-updated", handleUserUpdated);
    return () => window.removeEventListener("mpm:user-updated", handleUserUpdated);
  }, [refreshUser]);

  // When any API call is rejected with a plan-gate code (PRO_REQUIRED, etc.),
  // the user's subscription has been downgraded since their last profile fetch.
  // Refresh immediately so ProActionLock and plan-aware UI update on the next
  // render — one page navigation at most, no logout required.
  useEffect(() => {
    const handlePlanDowngraded = () => {
      console.log("📡 [AuthContext] mpm:plan-downgraded received — refreshing user plan");
      refreshUser().catch(() => {});
    };
    window.addEventListener("mpm:plan-downgraded", handlePlanDowngraded);
    return () => window.removeEventListener("mpm:plan-downgraded", handlePlanDowngraded);
  }, [refreshUser]);

  // Sync i18n language whenever user's preferredLanguage changes.
  useEffect(() => {
    if (!user) return;
    const lang = resolveI18nLang(user.preferredLanguage);
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [user?.preferredLanguage]);

  // Auto-detect language from device when user's preference is "auto".
  // Saves the resolved language to the profile so all AI generation uses it.
  useEffect(() => {
    if (!user || user.preferredLanguage !== "auto") return;
    const SUPPORTED = ["es","fr","de","it","pt","zh","ja","ko","ar","hi","ru","vi","tl"];
    const deviceLang = (navigator.language || "en").split("-")[0].toLowerCase();
    if (!SUPPORTED.includes(deviceLang)) return; // English or unsupported → keep "auto"
    const token = getAuthToken();
    if (!token) return;
    fetch(apiUrl("/api/user/preferences"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ preferredLanguage: deviceLang }),
    }).then(() => {
      refreshUser().catch(() => {});
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.preferredLanguage]);

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
          clearNutritionCache();
          window.location.href = "/login";
        }
      } catch {
        // Network error on probe — app may be offline, keep session
      }
    };

    window.addEventListener("mpm:visibility-resumed", handleVisibilityResumed);
    return () => window.removeEventListener("mpm:visibility-resumed", handleVisibilityResumed);
  }, []);

  // When a background polling loop receives a 401/403, the token was invalidated
  // while the component was still alive (e.g. after server-side logout without a
  // full page reload).  Sign out immediately so the stale polling stops and the
  // user is returned to the login page.
  useEffect(() => {
    const handlePollingAuthRejected = () => {
      const token = getAuthToken();
      if (!token) return; // Already signed out
      console.warn("⚠️ [AuthContext] mpm:polling-auth-rejected — token invalidated, signing out");
      setUser(null);
      localStorage.removeItem("mpm_current_user");
      localStorage.removeItem("userId");
      localStorage.removeItem("isAuthenticated");
      clearAuthToken();
      clearUserContext();
      clearNutritionCache();
      window.location.href = "/login";
    };
    window.addEventListener("mpm:polling-auth-rejected", handlePollingAuthRejected);
    return () => window.removeEventListener("mpm:polling-auth-rejected", handlePollingAuthRejected);
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
            clearNutritionCache();
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
        clearNutritionCache();
        const publicPaths = ["/login", "/welcome", "/auth", "/forgot-password", "/reset-password", "/pricing", "/privacy", "/guest-builder", "/guest-suite", "/consumer-welcome", "/procare-welcome", "/procare-identity", "/procare-attestation", "/founders", "/affiliates", "/delete-account", "/terms", "/privacy-policy", "/partners", "/join/studio", "/__modal-test__"];
        const isPublicPath = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + "/"));
        if (!isPublicPath) {
          window.location.href = "/welcome";
        }
      }

      hasFinishedInitialLoad.current = true;
      setIsSlowStart(false);
      setLoading(false);
    };

    initializeAuth();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refreshUser }}>
      {loading && isSlowStart && <WakingUpScreen />}
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
