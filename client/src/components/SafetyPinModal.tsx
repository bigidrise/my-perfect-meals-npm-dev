import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthToken } from "@/lib/auth";

interface SafetyPinModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (overrideToken: string) => void;
  allergen: string;
  mealRequest: string;
  blockedTerm?: string;
}

export function SafetyPinModal({
  open,
  onClose,
  onSuccess,
  allergen,
  mealRequest,
  blockedTerm,
}: SafetyPinModalProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (pin.length !== 4) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setError("Please log in to continue");
        return;
      }

      const response = await fetch(apiUrl("/api/safety-pin/verify-override"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({
          pin,
          allergen,
          mealRequest,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      setPin("");
      onSuccess(data.overrideToken);
    } catch (err) {
      setError("Could not verify PIN. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setPin("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-white">Allergy Safety Override</DialogTitle>
              <DialogDescription className="text-white/60">
                Temporarily disable allergy protection for this meal
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Primary Message */}
          <p className="text-white/90 text-sm leading-relaxed">
            You're about to temporarily turn off allergy protection for <strong>this meal only</strong>.
            This system exists to help prevent meals from being created with ingredients you've marked as unsafe.
          </p>

          {/* Blocked term warning */}
          {blockedTerm && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-200/80 text-sm">
                  Your request includes "{blockedTerm}" which conflicts with your {allergen} allergy.
                </p>
              </div>
            </div>
          )}

          {/* Safety Clarification */}
          <div className="p-3 rounded-lg bg-black/30 border border-white/10">
            <ul className="text-white/70 text-xs space-y-1">
              <li>• This override applies to <strong>one meal generation</strong></li>
              <li>• Allergy protection turns back <strong>on automatically</strong> afterward</li>
              <li>• Medical and clinical rules stay active</li>
              <li>• Use only if you're intentionally customizing this meal</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Enter Your 4-Digit Safety PIN
            </label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="● ● ● ●"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setPin(val);
                  setError(null);
                }}
                className="bg-black/40 border-white/20 text-white pr-10 text-center tracking-widest"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm mt-1.5">
                {error.toLowerCase().includes("pin") || error.toLowerCase().includes("verification") 
                  ? <><strong>Incorrect PIN</strong> - Allergy protection remains enabled.</>
                  : error
                }
              </p>
            )}

            <p className="text-white/40 text-xs mt-3 italic">
              Safety checks are based on your profile information and are designed to support safer food choices.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verifying || pin.length < 4}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {verifying ? "Verifying..." : "Confirm & Continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
