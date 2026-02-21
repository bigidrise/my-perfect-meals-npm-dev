import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { User, getCurrentUser, getAuthHeaders, getAuthToken } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { isGuestMode, getGuestSession } from "@/lib/guestMode";

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
      console.log("⚠️ [AuthContext] No token found - skipping refresh");
      return null;
    }

    try {
      console.log(
        "📡 [AuthContext] Refreshing user with token:",
        token.substring(0, 10) + "...",
      );
      const headers = {
        ...getAuthHeaders(),
        Authorization: `Bearer ${token}`, // Ensure Bearer token is sent
      };
      console.log("Request headers:", headers);

      const response = await fetch(apiUrl(`/api/user/profile`), {
        method: "GET",
        headers,
      });

      console.log("Refresh response status:", response.status);
      console.log("Refresh response headers:", [...response.headers.entries()]);

      if (response.ok) {
        const userData = await response.json();
        console.log("Refresh user data:", userData);
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
          profilePhotoUrl: userData.profilePhotoUrl || null,
          role: userData.role || "client",
          isProCare: userData.isProCare || false,
          activeBoard: userData.activeBoard || null,
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
          studioMembership: userData.studioMembership || null,
        };
        setUser(updatedUser);
        localStorage.setItem("mpm_current_user", JSON.stringify(updatedUser));
        console.log(
          "✅ [AuthContext] User refreshed successfully:",
          updatedUser.email,
        );
        return updatedUser;
      } else {
        const errorText = await response.text();
        console.error(
          "Refresh failed - status:",
          response.status,
          "body:",
          errorText,
        );
        return null;
      }
    } catch (error) {
      console.error("❌ [AuthContext] Refresh network error:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const currentUser = getCurrentUser();
      const token = getAuthToken();
      const appleReviewFullAccess =
        localStorage.getItem("appleReviewFullAccess") === "true";

      console.log(
        "InitializeAuth - token exists:",
        !!token,
        "currentUser:",
        currentUser,
      );

      if (token && currentUser && !currentUser.id.startsWith("guest-")) {
        setUser(currentUser);
        const freshUser = await refreshUser();
        if (!freshUser) {
          console.log(
            "⚠️ [AuthContext] refreshUser returned null - clearing state and redirecting",
          );
          setUser(null);
          localStorage.removeItem("mpm_current_user");
          localStorage.removeItem("userId");
          localStorage.removeItem("isAuthenticated");
          localStorage.removeItem("authToken");
          if (
            window.location.pathname !== "/login" &&
            window.location.pathname !== "/welcome"
          ) {
            window.location.href = "/login";
          }
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
        console.log("✅ [AuthContext] Apple Review full access mode enabled");
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
        console.log("✅ [AuthContext] Guest mode enabled");
      } else {
        console.log(
          "⚠️ [AuthContext] No valid auth - clearing state and redirecting",
        );
        setUser(null);
        localStorage.removeItem("mpm_current_user");
        localStorage.removeItem("userId");
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("authToken");
        if (
          window.location.pathname !== "/login" &&
          window.location.pathname !== "/welcome"
        ) {
          window.location.href = "/login";
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
