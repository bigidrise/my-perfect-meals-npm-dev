/**
 * FeatureUpgradeModal
 * ───────────────────
 * Generic one-modal-for-all-locked-actions upgrade prompt.
 * Pass featureName + description to describe the specific feature the user
 * tried to use. The modal stores the current path so CheckoutSuccess returns
 * them to exactly the right Business Center page after payment.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <button onClick={() => setOpen(true)}>Generate Referral Link</button>
 *   <FeatureUpgradeModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     featureName="Referral Link & QR Code"
 *     description="Generate your referral link, QR code, and promo code to start earning partner commissions."
 *   />
 */
import { Lock } from "lucide-react";
import { useLocation } from "wouter";
import { UniversalDialog } from "@/components/ui/universal-modal";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface FeatureUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Short name for the feature, e.g. "Referral Link & QR Code" */
  featureName: string;
  /** One sentence explaining what the user gets with Pro. */
  description: string;
}

export function FeatureUpgradeModal({
  open,
  onClose,
  featureName,
  description,
}: FeatureUpgradeModalProps) {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    onClose();
    sessionStorage.setItem("mpm_business_return", window.location.pathname);
    setLocation("/pricing?plan=mpm_premium_monthly");
  };

  return (
    <UniversalDialog
      rawLayout
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}
      className="max-w-sm mx-auto bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 border-white/10 rounded-2xl"
    >
      <div className="p-6">
      <DialogHeader className="text-center items-center">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-orange-400" />
          </div>
        </div>
        <div className="flex justify-center mb-2">
          <span className="px-3 py-1 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 text-xs font-semibold tracking-wide">
            Pro Required
          </span>
        </div>
        <DialogTitle className="text-lg font-bold text-white leading-snug">
          {featureName}
        </DialogTitle>
        <DialogDescription className="text-white/55 text-sm mt-1 leading-relaxed">
          {description}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2 mt-5">
        <button
          onClick={handleUpgrade}
          className="w-full py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm transition-colors active:bg-orange-700"
        >
          Upgrade to Pro
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/5 text-white/55 text-sm transition-colors active:bg-white/10"
        >
          Not Now
        </button>
      </div>
      </div>
    </UniversalDialog>
  );
}

export default FeatureUpgradeModal;
