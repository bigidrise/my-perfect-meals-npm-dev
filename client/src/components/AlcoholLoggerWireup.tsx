import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { logAlcoholToBiometrics } from "@/utils/alcoholLog";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  drinkType: string;
  volumeMl: number;
  abvPercent: number;
  notes?: string;
  userId?: string;
  onLogged?: () => void;
};

/** Invisible logic component: no UI, no layout changes */
export default function AlcoholLoggerWireup({
  drinkType,
  volumeMl,
  abvPercent,
  notes,
  userId: userIdProp,
  onLogged,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = userIdProp || user?.id || "";

  const handleLog = useCallback(async () => {
    if (!userId) return;
    try {
      await logAlcoholToBiometrics({
        userId,
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