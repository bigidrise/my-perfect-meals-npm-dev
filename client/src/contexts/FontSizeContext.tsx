import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
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

interface FontSizeProviderProps {
  children: ReactNode;
}

export function FontSizeProvider({ children }: FontSizeProviderProps) {
  const { user } = useAuth();
  const [fontSize, setFontSizeState] = useState<FontSize>("standard");

  useEffect(() => {
    const savedSize = user?.fontSizePreference || localStorage.getItem(FONT_SIZE_STORAGE_KEY) as FontSize || "standard";
    setFontSizeState(savedSize);
    applyFontSize(savedSize);
  }, [user?.fontSizePreference]);

  const applyFontSize = (size: FontSize) => {
    const root = document.documentElement;
    Object.values(FONT_SIZE_CLASSES).forEach((cls) => root.classList.remove(cls));
    root.classList.add(FONT_SIZE_CLASSES[size]);
  };

  const setFontSize = useCallback(async (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);

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
