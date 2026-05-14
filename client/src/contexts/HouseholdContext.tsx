import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { isHouseholdPlan } from "@shared/planFeatures";

export interface HouseholdProfile {
  id: string;
  ownerUserId: string;
  displayName: string;
  avatarEmoji: string | null;
  age: number | null;
  isOwnerProfile: boolean;
  dietaryRestrictions: string[];
  allergies: string[];
  healthConditions: string[];
  medicalConditions: string[];
  specialtyCondition: string | null;
  specialtyConditions: string[];
  dislikedFoods: string[];
  avoidedFoods: string[];
  likedFoods: string[];
  preferredSweeteners: string[];
  cuisinePreference: string | null;
  cuisineIntensity: string | null;
  palateSpiceTolerance: string | null;
  palateSeasoningIntensity: string | null;
  palateFlavorStyle: string | null;
  fitnessGoal: string | null;
  activityLevel: string | null;
  dailyCalorieTarget: number | null;
  dailyProteinTarget: number | null;
  dailyCarbsTarget: number | null;
  dailyFatTarget: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface HouseholdContextType {
  profiles: HouseholdProfile[];
  activeProfileId: string | null;
  activeProfile: HouseholdProfile | null;
  isHousehold: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  setActive: (profileId: string | null) => Promise<void>;
  createProfile: (data: Partial<HouseholdProfile>) => Promise<HouseholdProfile>;
  updateProfile: (id: string, data: Partial<HouseholdProfile>) => Promise<HouseholdProfile>;
  deleteProfile: (id: string) => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

const STORAGE_KEY = "mpm.household.activeProfileId";

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<HouseholdProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(false);

  const isHousehold = isHouseholdPlan(user?.planLookupKey ?? null);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  const refresh = useCallback(async () => {
    if (!user || !isHousehold) {
      setProfiles([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/household/profiles"), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles ?? []);
      }
    } catch (err) {
      console.error("[HouseholdContext] Failed to load profiles:", err);
    } finally {
      setLoading(false);
    }
  }, [user, isHousehold]);

  useEffect(() => {
    if (isHousehold) refresh();
  }, [isHousehold, refresh]);

  const setActive = useCallback(
    async (profileId: string | null) => {
      try {
        const res = await fetch(apiUrl("/api/household/active"), {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        });
        if (res.ok) {
          setActiveProfileId(profileId);
          if (profileId) {
            localStorage.setItem(STORAGE_KEY, profileId);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error("[HouseholdContext] Failed to set active profile:", err);
      }
    },
    [],
  );

  const createProfile = useCallback(
    async (data: Partial<HouseholdProfile>): Promise<HouseholdProfile> => {
      const res = await fetch(apiUrl("/api/household/profiles"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create profile");
      }
      const { profile } = await res.json();
      setProfiles((prev) => [...prev, profile]);
      return profile;
    },
    [],
  );

  const updateProfile = useCallback(
    async (id: string, data: Partial<HouseholdProfile>): Promise<HouseholdProfile> => {
      const res = await fetch(apiUrl(`/api/household/profiles/${id}`), {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update profile");
      }
      const { profile } = await res.json();
      setProfiles((prev) => prev.map((p) => (p.id === id ? profile : p)));
      return profile;
    },
    [],
  );

  const deleteProfile = useCallback(async (id: string) => {
    const res = await fetch(apiUrl(`/api/household/profiles/${id}`), {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete profile");
    }
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeProfileId === id) {
      setActiveProfileId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeProfileId]);

  return (
    <HouseholdContext.Provider
      value={{
        profiles,
        activeProfileId,
        activeProfile,
        isHousehold,
        loading,
        refresh,
        setActive,
        createProfile,
        updateProfile,
        deleteProfile,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}
