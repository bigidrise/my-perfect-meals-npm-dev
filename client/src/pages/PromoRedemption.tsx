import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Gift, Clock, Tag, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface PromoPreview {
  id: string;
  name: string;
  type: "extended_trial" | "discount";
  trial_days: number | null;
  discount_percent: number | null;
  discount_duration: string | null;
  discount_months: number | null;
  used_count: number;
  max_uses: number | null;
  expires_at: string | null;
  owner_name: string | null;
}

function promoDescription(p: PromoPreview): string {
  if (p.type === "extended_trial") {
    return `${p.trial_days} days of full My Perfect Meals access — no credit card required.`;
  }
  if (p.type === "discount") {
    const dur = p.discount_duration === "forever"
      ? "on every payment"
      : p.discount_duration === "once"
        ? "on your first payment"
        : `for ${p.discount_months} months`;
    return `${p.discount_percent}% off ${dur} when you subscribe.`;
  }
  return "";
}

export default function PromoRedemption() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, user, refreshUser } = useAuth();

  const [preview, setPreview] = useState<PromoPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemResult, setRedeemResult] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest(`/api/promotions/preview/${token}`)
      .then(data => setPreview(data.promotion))
      .catch(err => setLoadError(err.message || "Promotion not found"))
      .finally(() => setLoading(false));
  }, [token]);

  const redeem = async () => {
    if (!isAuthenticated) {
      // Store token in session and redirect to auth
      sessionStorage.setItem("pendingPromoToken", token);
      setLocation(`/auth?returnTo=/join/promo/${token}`);
      return;
    }
    setRedeeming(true);
    setRedeemError("");
    try {
      const result = await apiRequest(`/api/promotions/redeem/${token}`, { method: "POST" });
      setRedeemResult(result);
      setRedeemed(true);
      if (result.type === "extended_trial") {
        await refreshUser();
      }
    } catch (err: any) {
      setRedeemError(err.message || "Failed to redeem promotion");
    } finally {
      setRedeeming(false);
    }
  };

  // Auto-redeem if returning from auth with a pending token
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const pending = sessionStorage.getItem("pendingPromoToken");
    if (pending === token && !redeemed) {
      sessionStorage.removeItem("pendingPromoToken");
      redeem();
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Promotion Not Available</h2>
          <p className="text-white/50 text-sm mb-6">{loadError}</p>
          <button
            onClick={() => setLocation("/dashboard")}
            className="px-6 py-3 rounded-2xl bg-orange-600 text-white font-bold text-sm"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (redeemed && redeemResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-emerald-900/20 to-black flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">You're in!</h2>
          <p className="text-white/60 text-sm mb-6">{redeemResult.message}</p>

          {redeemResult.type === "discount" && redeemResult.appliedPromoCode && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
              <p className="text-xs text-amber-400/70 uppercase tracking-wide mb-1">Your Promo Code</p>
              <p className="text-2xl font-mono font-black text-amber-400">{redeemResult.appliedPromoCode}</p>
              <p className="text-xs text-white/40 mt-1">Applied automatically at checkout</p>
            </div>
          )}

          <button
            onClick={() => setLocation("/dashboard")}
            className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
          >
            Go to My Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <img src="/icons/chef.png" alt="My Perfect Meals" className="w-12 h-12 mx-auto mb-3 rounded-2xl" />
          <p className="text-white/40 text-sm">My Perfect Meals</p>
        </div>

        {/* Promo card */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              preview!.type === "extended_trial" ? "bg-blue-500/20" : "bg-amber-500/20"
            }`}>
              {preview!.type === "extended_trial"
                ? <Clock className="w-5 h-5 text-blue-400" />
                : <Tag className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{preview!.name}</p>
              {preview!.owner_name && (
                <p className="text-xs text-white/40">from {preview!.owner_name}</p>
              )}
            </div>
          </div>

          <div className="bg-black/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-orange-400" />
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide">Your Offer</p>
            </div>
            <p className="text-white font-bold text-lg">
              {preview!.type === "extended_trial"
                ? `${preview!.trial_days} Days Free`
                : `${preview!.discount_percent}% Off`}
            </p>
            <p className="text-white/50 text-sm mt-0.5">{promoDescription(preview!)}</p>
          </div>

          <div className="text-xs text-white/30 space-y-1">
            {preview!.max_uses && (
              <p>{preview!.max_uses - preview!.used_count} of {preview!.max_uses} uses remaining</p>
            )}
            {preview!.expires_at && (
              <p>Expires {new Date(preview!.expires_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {redeemError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-xs text-red-400 text-center">
            {redeemError}
          </div>
        )}

        <button
          onClick={redeem}
          disabled={redeeming}
          className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {redeeming && <Loader2 className="w-4 h-4 animate-spin" />}
          {redeeming ? "Applying…" : isAuthenticated ? "Claim This Offer" : "Sign Up & Claim"}
        </button>

        {!isAuthenticated && (
          <p className="text-center text-xs text-white/30 mt-3">
            Already have an account?{" "}
            <button
              className="text-orange-400 underline"
              onClick={() => {
                sessionStorage.setItem("pendingPromoToken", token);
                setLocation(`/auth?returnTo=/join/promo/${token}`);
              }}
            >
              Log in to claim
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}
