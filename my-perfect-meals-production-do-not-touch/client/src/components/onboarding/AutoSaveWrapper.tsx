import { useEffect, useRef } from "react";
import { useStepProgress } from "@/hooks/useOnboardingProgress";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";

interface AutoSaveWrapperProps {
  stepKey: string;
  formData: any;
  userId?: string;
  children: React.ReactNode;
  debounceMs?: number;
}

export function AutoSaveWrapper({ 
  stepKey, 
  formData, 
  userId, 
  children,
  debounceMs = 5000 // Further increased debounce time to stop API spam
}: AutoSaveWrapperProps) {
  // EMERGENCY CIRCUIT BREAKER: Disable auto-save completely to stop API spam
  const isAutoSaveDisabled = true;
  const { saveStep } = useStepProgress(stepKey, userId);
  const debouncedFormData = useDebounce(formData, debounceMs);
  const initialLoad = useRef(true);
  const lastSavedData = useRef<string>('');
  const isSaving = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    // EMERGENCY: Auto-save completely disabled to prevent API spam
    if (isAutoSaveDisabled) {
      console.log("🚫 Auto-save DISABLED - manual save only");
      return;
    }

    // Skip auto-save on initial component mount
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    // Skip if already saving to prevent concurrent saves
    if (isSaving.current) {
      console.log("⏳ Auto-save skipped - already saving");
      return;
    }

    // Only auto-save if there's actual data
    if (debouncedFormData && Object.keys(debouncedFormData).length > 0) {
      // Create a stable string representation for comparison
      const currentDataStr = JSON.stringify(debouncedFormData, Object.keys(debouncedFormData).sort());
      
      // Skip save if data hasn't actually changed
      if (currentDataStr === lastSavedData.current) {
        console.log("💾 Auto-save skipped - no data change detected");
        return;
      }

      console.log("💾 Auto-save triggered:", { stepKey, dataKeys: Object.keys(debouncedFormData) });
      isSaving.current = true;
      
      saveStep.mutate({ 
        data: debouncedFormData, 
        completed: false,
        apply: false // Don't apply to user preferences on auto-save, only on explicit save
      }, {
        onSuccess: (result) => {
          console.log("✅ Auto-save successful:", result);
          lastSavedData.current = currentDataStr;
          isSaving.current = false;
          
          // Silent auto-save - no toast to prevent UI spam
        },
        onError: (error) => {
          console.error("❌ Auto-save failed:", error);
          isSaving.current = false;
          // Don't show error toast for auto-save to avoid spam
        }
      });
    }
  }, [debouncedFormData, saveStep, toast]);

  return <>{children}</>;
}