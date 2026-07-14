import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export type NarrationSpeed = "0.75" | "1.0" | "1.25" | "1.5";

interface NarrationSpeedContextType {
  narrationSpeed: NarrationSpeed;
  setNarrationSpeed: (speed: NarrationSpeed) => Promise<void>;
}

const NarrationSpeedContext = createContext<NarrationSpeedContextType | undefined>(undefined);

const STORAGE_KEY = "mpm_narration_speed_preference";
const VALID_SPEEDS: NarrationSpeed[] = ["0.75", "1.0", "1.25", "1.5"];
const DEFAULT_SPEED: NarrationSpeed = "1.0";

function isValidSpeed(val: string | null | undefined): val is NarrationSpeed {
  return typeof val === "string" && VALID_SPEEDS.includes(val as NarrationSpeed);
}

function getStoredSpeed(): NarrationSpeed {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidSpeed(stored) ? stored : DEFAULT_SPEED;
  } catch {
    return DEFAULT_SPEED;
  }
}

export function NarrationSpeedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [narrationSpeed, setNarrationSpeedState] = useState<NarrationSpeed>(getStoredSpeed);

  useEffect(() => {
    const serverPref = user?.narrationSpeedPreference;
    if (!isValidSpeed(serverPref)) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return;
    } catch {
      return;
    }
    setNarrationSpeedState(serverPref);
    localStorage.setItem(STORAGE_KEY, serverPref);
  }, [user?.narrationSpeedPreference]);

  const setNarrationSpeed = useCallback(async (speed: NarrationSpeed) => {
    setNarrationSpeedState(speed);
    localStorage.setItem(STORAGE_KEY, speed);

    if (user) {
      try {
        await fetch(apiUrl("/api/users/profile"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ narrationSpeedPreference: speed }),
        });
      } catch (error) {
        console.error("[NarrationSpeed] Failed to save preference:", error);
      }
    }
  }, [user]);

  return (
    <NarrationSpeedContext.Provider value={{ narrationSpeed, setNarrationSpeed }}>
      {children}
    </NarrationSpeedContext.Provider>
  );
}

export function useNarrationSpeed() {
  const context = useContext(NarrationSpeedContext);
  if (context === undefined) {
    throw new Error("useNarrationSpeed must be used within a NarrationSpeedProvider");
  }
  return context;
}
