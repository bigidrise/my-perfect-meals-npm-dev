import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Eye, EyeOff, Check, X } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type Mode = "view" | "set" | "change" | "remove";

export function SafetyPinSettings() {
  const { toast } = useToast();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [loading, setLoading] = useState(false);
  
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setAuthFailed(true);
        return;
      }

      const response = await fetch(apiUrl("/api/safety-pin/status"), {
        headers: { "x-auth-token": authToken },
      });
      
      if (response.ok) {
        const data = await response.json();
        setHasPin(data.hasPin);
        setAuthFailed(false);
      } else if (response.status === 401) {
        setAuthFailed(true);
      }
    } catch (err) {
      console.error("Failed to check PIN status:", err);
      setAuthFailed(true);
    }
  };

  const handleSetPin = async () => {
    setError(null);
    
    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    
    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    
    setLoading(true);
    
    try {
      const authToken = getAuthToken();
      const response = await fetch(apiUrl("/api/safety-pin/set"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken || "",
        },
        body: JSON.stringify({ pin: newPin }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Failed to set PIN");
        return;
      }
      
      toast({ title: "Safety PIN Set", description: "Your Safety PIN has been created." });
      setHasPin(true);
      resetForm();
    } catch (err) {
      setError("Could not set PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    setError(null);
    
    if (!/^\d{4}$/.test(newPin)) {
      setError("New PIN must be exactly 4 digits");
      return;
    }
    
    if (newPin !== confirmPin) {
      setError("New PINs do not match");
      return;
    }
    
    setLoading(true);
    
    try {
      const authToken = getAuthToken();
      const response = await fetch(apiUrl("/api/safety-pin/change"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken || "",
        },
        body: JSON.stringify({ currentPin, newPin }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Failed to change PIN");
        return;
      }
      
      toast({ title: "PIN Changed", description: "Your Safety PIN has been updated." });
      resetForm();
    } catch (err) {
      setError("Could not change PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const authToken = getAuthToken();
      const response = await fetch(apiUrl("/api/safety-pin/remove"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken || "",
        },
        body: JSON.stringify({ pin: currentPin }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Failed to remove PIN");
        return;
      }
      
      toast({ title: "PIN Removed", description: "Your Safety PIN has been removed." });
      setHasPin(false);
      resetForm();
    } catch (err) {
      setError("Could not remove PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMode("view");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setError(null);
    setShowPin(false);
  };

  if (authFailed) {
    return (
      <Card className="bg-black/30 border-white/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Safety PIN</h3>
              <p className="text-amber-400 text-xs">
                Session expired - please log out and back in to manage your PIN
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasPin === null) {
    return (
      <Card className="bg-black/30 border-white/10">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10" />
            <div className="h-4 w-32 bg-white/10 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/30 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Safety PIN</h3>
            <p className="text-white/60 text-xs">
              {hasPin ? "PIN is set - extra protection enabled" : "No PIN set - set one for extra protection"}
            </p>
          </div>
        </div>

        {mode === "view" && (
          <div className="flex gap-2">
            {hasPin ? (
              <>
                <Button
                  size="sm"
                  className="bg-black/40 backdrop-blur-sm border border-white/20 text-white hover:bg-black/60"
                  onClick={() => setMode("change")}
                >
                  Change PIN
                </Button>
                <Button
                  size="sm"
                  className="bg-black/40 backdrop-blur-sm border border-white/20 text-white hover:bg-black/60"
                  onClick={() => setMode("remove")}
                >
                  Remove PIN
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-500 text-white"
                onClick={() => setMode("set")}
              >
                Set Safety PIN
              </Button>
            )}
          </div>
        )}

        {mode === "set" && (
          <div className="space-y-3">
            <PinInput label="Enter PIN" value={newPin} onChange={setNewPin} showPin={showPin} />
            <PinInput label="Confirm PIN" value={confirmPin} onChange={setConfirmPin} showPin={showPin} />
            <ToggleShowPin showPin={showPin} setShowPin={setShowPin} />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <FormButtons loading={loading} onSubmit={handleSetPin} onCancel={resetForm} submitLabel="Set PIN" />
          </div>
        )}

        {mode === "change" && (
          <div className="space-y-3">
            <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} showPin={showPin} />
            <PinInput label="New PIN" value={newPin} onChange={setNewPin} showPin={showPin} />
            <PinInput label="Confirm New PIN" value={confirmPin} onChange={setConfirmPin} showPin={showPin} />
            <ToggleShowPin showPin={showPin} setShowPin={setShowPin} />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <FormButtons loading={loading} onSubmit={handleChangePin} onCancel={resetForm} submitLabel="Change PIN" />
          </div>
        )}

        {mode === "remove" && (
          <div className="space-y-3">
            <p className="text-white/70 text-sm">Enter your current PIN to remove it.</p>
            <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} showPin={showPin} />
            <ToggleShowPin showPin={showPin} setShowPin={setShowPin} />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <FormButtons loading={loading} onSubmit={handleRemovePin} onCancel={resetForm} submitLabel="Remove PIN" destructive />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PinInput({ label, value, onChange, showPin }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPin: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">{label}</label>
      <Input
        type={showPin ? "text" : "password"}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        placeholder="4 digits"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="bg-black/40 border-white/20 text-white"
      />
    </div>
  );
}

function ToggleShowPin({ showPin, setShowPin }: { showPin: boolean; setShowPin: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => setShowPin(!showPin)}
      className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm"
    >
      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      {showPin ? "Hide PIN" : "Show PIN"}
    </button>
  );
}

function FormButtons({ loading, onSubmit, onCancel, submitLabel, destructive }: {
  loading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <Button
        size="sm"
        className="bg-black/40 backdrop-blur-sm border border-white/20 text-white hover:bg-black/60"
        onClick={onCancel}
        disabled={loading}
      >
        <X className="w-4 h-4 mr-1" /> Cancel
      </Button>
      <Button
        size="sm"
        className={destructive 
          ? "bg-black/40 backdrop-blur-sm border border-red-500/50 text-white hover:bg-black/60" 
          : "bg-green-600 hover:bg-green-500 text-white"}
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? "..." : <><Check className="w-4 h-4 mr-1" /> {submitLabel}</>}
      </Button>
    </div>
  );
}
