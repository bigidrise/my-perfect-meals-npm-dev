import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

type FontSize = "standard" | "large" | "xl";

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => Promise<void>;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const FONT_SIZE_STORAGE_KEY = "mpm_font_size_preference";

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  standard: "font-size-standard",
  large: "font-size-large",
  xl: "font-size-xl",
};

const VALID_SIZES: FontSize[] = ["standard", "large", "xl"];

function isValidFontSize(val: string | null | undefined): val is FontSize {
  return typeof val === "string" && VALID_SIZES.includes(val as FontSize);
}

function applyFontSize(size: FontSize) {
  const root = document.documentElement;
  Object.values(FONT_SIZE_CLASSES).forEach((cls) => root.classList.remove(cls));
  root.classList.add(FONT_SIZE_CLASSES[size]);
}

function getStoredSize(): FontSize {
  try {
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return isValidFontSize(stored) ? stored : "standard";
  } catch {
    return "standard";
  }
}

const initialSize = getStoredSize();
applyFontSize(initialSize);

interface FontSizeProviderProps {
  children: ReactNode;
}

export function FontSizeProvider({ children }: FontSizeProviderProps) {
  const { user } = useAuth();
  const [fontSize, setFontSizeState] = useState<FontSize>(initialSize);
  const hasAppliedServerPref = useRef(false);

  useEffect(() => {
    const serverPref = user?.fontSizePreference;
    if (isValidFontSize(serverPref) && !hasAppliedServerPref.current) {
      hasAppliedServerPref.current = true;
      setFontSizeState(serverPref);
      applyFontSize(serverPref);
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, serverPref);
    }
  }, [user?.fontSizePreference]);

  const setFontSize = useCallback(async (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    hasAppliedServerPref.current = true;

    if (user) {
      try {
        await fetch(apiUrl("/api/users/profile"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ fontSizePreference: size }),
        });
      } catch (error) {
        console.error("Failed to save font size preference:", error);
      }
    }
  }, [user]);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
}
