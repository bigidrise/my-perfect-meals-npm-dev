// client/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { User, getCurrentUser, getAuthHeaders, getAuthToken } from "@/lib/auth";
import { apiUrl } from '@/lib/resolveApiBase';

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
    
    if (token && currentUser && !currentUser.id.startsWith("guest-")) {
      // User has valid auth token - set authenticated state
      setUser(currentUser);
      setLoading(false);
      // Refresh user data from server
      refreshUser();
    } else {
      // No valid token - user is not authenticated
      // Clear any stale auth data
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