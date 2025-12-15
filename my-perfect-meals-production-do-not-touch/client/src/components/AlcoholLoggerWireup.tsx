import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { logAlcoholToBiometrics } from "@/utils/alcoholLog";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

type Props = {
  // Provide values from your existing page state/inputs
  drinkType: string;
  volumeMl: number;      // e.g., 355 for a can, 150 for a glass of wine
  abvPercent: number;    // e.g., 5 for beer, 12 for wine, 40 for spirits
  notes?: string;
  // Called when saved (optional)
  onLogged?: () => void;
};

/** Invisible logic component: no UI, no layout changes */
export default function AlcoholLoggerWireup({
  drinkType,
  volumeMl,
  abvPercent,
  notes,
  onLogged,
}: Props) {
  const { toast } = useToast();

  const handleLog = useCallback(async () => {
    try {
      await logAlcoholToBiometrics({
        userId: DEV_USER_ID,
        drinkType: drinkType || "unspecified",
        volumeMl: Number(volumeMl) || 0,
        abvPercent: Number(abvPercent) || 0,
        notes: notes?.trim() || undefined,
      });

      // Invalidate biometrics like food logs do (instant refresh, no page reload)
      queryClient.invalidateQueries({ queryKey: ["biometrics"] });
      queryClient.invalidateQueries({ queryKey: ["biometrics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["biometrics-daily"] });

      toast({ title: "Logged!", description: "Alcohol entry added to Biometrics." });
      onLogged?.();
    } catch (e: any) {
      toast({
        title: "Log failed",
        description: e?.message || "Could not save entry.",
        variant: "destructive",
      });
    }
  }, [drinkType, volumeMl, abvPercent, notes, toast, onLogged]);

  // This component renders nothing (keeps aesthetics untouched)
  return null as any;
}

// If you prefer, export handle factory:
export function useAlcoholLogHandler(params: Parameters<typeof logAlcoholToBiometrics>[0]) {
  const { toast } = useToast();
  return async () => {
    try {
      await logAlcoholToBiometrics(params);
      queryClient.invalidateQueries({ queryKey: ["biometrics"] });
      queryClient.invalidateQueries({ queryKey: ["biometrics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["biometrics-daily"] });
      toast({ title: "Logged!", description: "Alcohol entry added." });
    } catch (e: any) {
      toast({ title: "Log failed", description: e?.message || "Could not save entry.", variant: "destructive" });
    }
  };
}