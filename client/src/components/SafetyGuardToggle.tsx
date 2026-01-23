import { useState, useEffect } from "react";
import { X, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PillButton } from "@/components/ui/pill-button";

interface SafetyGuardToggleProps {
  safetyEnabled: boolean;
  onSafetyChange: (enabled: boolean, overrideToken?: string) => void;
  disabled?: boolean;
}

export function SafetyGuardToggle({
  safetyEnabled,
  onSafetyChange,
  disabled = false,
}: SafetyGuardToggleProps) {
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!showPinEntry) {
      setPin("");
      setError(null);
    }
  }, [showPinEntry]);

  const handleToggleClick = () => {
    if (disabled) return;
    
    if (safetyEnabled) {
      setShowPinEntry(true);
    } else {
      onSafetyChange(true);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const data = await apiRequest("/api/safety-pin/verify-override", {
        method: "POST",
        body: JSON.stringify({
          pin,
          allergen: "user-override",
          mealRequest: "Safety override requested",
        }),
      });

      toast({
        title: "Safety Override Activated",
        description: "Allergy protection disabled for this meal only.",
        variant: "default",
      });
      setShowPinEntry(false);
      setPin("");
      onSafetyChange(false, data.overrideToken);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("attempts remaining")) {
        setError(msg.split(": ").pop() || "Incorrect PIN");
      } else if (msg.includes("locked") || msg.includes("Too many")) {
        setError("Too many attempts. Try again later.");
      } else if (msg.includes("Incorrect")) {
        setError("Incorrect PIN");
      } else {
        setError("Failed to verify PIN");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Branded Label */}
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs text-white/70 font-medium">
            SafetyGuard <span className="text-white/50">—</span> <span className="text-green-400/80">Allergy Protection</span>
          </span>
        </div>
        
        {/* Toggle Button */}
        <PillButton
          disabled={disabled}
          onClick={handleToggleClick}
          active={safetyEnabled}
          aria-label={safetyEnabled ? "Safety On - Click to disable" : "Safety Off - Click to enable"}
        >
          {safetyEnabled ? "On" : "Off"}
        </PillButton>
      </div>

      {showPinEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-80 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-semibold text-white">SafetyGuard Override</h3>
              </div>
              <button
                onClick={() => setShowPinEntry(false)}
                className="text-white/60 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-white/70 mb-4">
              Enter your 4-digit PIN to disable Allergy Protection for this meal only.
            </p>

            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold
                    ${i < pin.length ? "border-green-500 bg-green-500/20 text-white" : "border-white/30 bg-black/20"}`}
                >
                  {i < pin.length ? "•" : ""}
                </div>
              ))}
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center mb-3">{error}</p>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={key === "" || isVerifying}
                  onClick={() => {
                    if (key === "⌫") handleBackspace();
                    else if (key !== "") handleKeyPress(key);
                  }}
                  className={`h-12 rounded-lg text-xl font-medium transition
                    ${key === "" ? "invisible" : ""}
                    ${key === "⌫" ? "bg-red-600/30 text-red-300 hover:bg-red-600/50" : "bg-white/10 text-white hover:bg-white/20"}
                    ${isVerifying ? "opacity-50" : ""}`}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              onClick={handlePinSubmit}
              disabled={pin.length < 4 || isVerifying}
              className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? "Verifying..." : "Confirm Override"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
