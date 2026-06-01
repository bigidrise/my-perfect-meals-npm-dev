import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { TierUpgradeModal } from "@/components/modals/TierUpgradeModal";

export type RequiredTier = "essential" | "pro" | "clinical";

interface UpgradeRequest {
  requiredTier: RequiredTier;
  featureName?: string;
}

interface UpgradeModalContextType {
  requestUpgrade: (config: UpgradeRequest) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<UpgradeRequest | null>(null);

  const requestUpgrade = useCallback((config: UpgradeRequest) => {
    setCurrent(config);
    setOpen(true);
  }, []);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <UpgradeModalContext.Provider value={{ requestUpgrade }}>
      {children}
      {current && (
        <TierUpgradeModal
          open={open}
          onClose={handleClose}
          requiredTier={current.requiredTier}
          featureName={current.featureName}
        />
      )}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalContextType {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error("useUpgradeModal must be used within UpgradeModalProvider");
  return ctx;
}
