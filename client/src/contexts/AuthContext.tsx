// client/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { User, getCurrentUser, getAuthHeaders, getAuthToken } from "@/lib/auth";
import { apiUrl } from '@/lib/resolveApiBase';
import { isGuestMode, getGuestSession } from "@/lib/guestMode";

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/user/profile`), {
        headers: {
          ...getAuthHeaders(),
        },
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
          profilePhotoUrl: userData.profilePhotoUrl || null,
          // Role-based access control
          role: userData.role || "client",
          isProCare: userData.isProCare || false,
          activeBoard: userData.activeBoard || null,
          // Onboarding completion - CRITICAL for enforcing onboarding gate
          onboardingCompletedAt: userData.onboardingCompletedAt || null,
          // Profile data from onboarding (used by Edit Profile)
          firstName: userData.firstName || null,
          lastName: userData.lastName || null,
          age: userData.age || null,
          height: userData.height || null,
          weight: userData.weight || null,
          activityLevel: userData.activityLevel || null,
          fitnessGoal: userData.fitnessGoal || null,
          allergies: userData.allergies || [],
          dietaryRestrictions: userData.dietaryRestrictions || [],
        };
        setUser(updatedUser);
        localStorage.setItem("mpm_current_user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, []);

  useEffect(() => {
    // Initialize user from localStorage only if we have a valid auth token
    const currentUser = getCurrentUser();
    const token = getAuthToken();
    
    // Check for Apple Review Full Access mode (allows full app access without auth)
    const appleReviewFullAccess = localStorage.getItem("appleReviewFullAccess") === "true";
    
    if (token && currentUser && !currentUser.id.startsWith("guest-")) {
      // User has valid auth token - set authenticated state
      setUser(currentUser);
      setLoading(false);
      // Refresh user data from server
      refreshUser();
    } else if (appleReviewFullAccess) {
      // Apple Review Full Access mode - create a demo user with FULL admin access
      // Must match Welcome.tsx demo user exactly to prevent state mismatch on reload
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
        role: "admin", // Admin role for full access - matches Welcome.tsx
        isProCare: false,
        activeBoard: "weekly",
        onboardingCompletedAt: new Date().toISOString(), // Skip onboarding - matches Welcome.tsx
      };
      setUser(demoUser);
      localStorage.setItem("mpm_current_user", JSON.stringify(demoUser));
      setLoading(false);
    } else if (isGuestMode()) {
      // Guest mode (Build a Day) - create a guest user for limited meal creation
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
      setLoading(false);
    } else {
      // No valid token - user is not authenticated
      // Clear any stale auth data (but preserve guest mode flags)
      localStorage.removeItem("mpm_current_user");
      localStorage.removeItem("userId");
      localStorage.removeItem("isAuthenticated");
      setUser(null);
      setLoading(false);
    }
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