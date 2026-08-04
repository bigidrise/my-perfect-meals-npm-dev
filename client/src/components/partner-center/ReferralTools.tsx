import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  CheckCircle2,
  Loader2,
  AlertCircle,
  QrCode,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProActionLock } from "@/components/ProActionLock";

interface PartnerProfile {
  hasPartnerAccount: boolean;
  partnerName?: string;
  promoCode?: string | null;
  promoCodeSecondary?: string | null;
  customerDiscount?: number | null;
  referralUrl?: string | null;
  brandingMode?: string;
  status?: string;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-medium transition-colors active:scale-[0.97]"
    >
      {copied ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function ReferralTools() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    fetch("/api/marketing-center/profile", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
        }
        return res.json();
      })
      .then((data: PartnerProfile) => {
        setProfile(data);
        if (data.hasPartnerAccount && (data.referralUrl || data.promoCode)) {
          loadQr();
        }
      })
      .catch((err) => {
        console.error("[ReferralTools] profile load error:", err);
        setLoadError("Could not load your partner profile. Please refresh or contact support.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadQr() {
    setQrLoading(true);
    try {
      const res = await fetch("/api/marketing-center/qr?format=png", {
        credentials: "include",
      });
      if (res.ok) {
        const blob = await res.blob();
        setQrSrc(URL.createObjectURL(blob));
      }
    } catch {
      // silent — QR preview is non-critical
    } finally {
      setQrLoading(false);
    }
  }

  function downloadQr(format: "png" | "svg") {
    const a = document.createElement("a");
    a.href = `/api/marketing-center/qr?format=${format}&download=1`;
    a.download = `referral-qr.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ description: `Downloading QR code as ${format.toUpperCase()}…` });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (loadError || !profile?.hasPartnerAccount) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-black/40 border border-white/10 p-6 text-center">
          <QrCode className="h-10 w-10 text-orange-400/40 mx-auto mb-3" />
          <p className="text-white font-semibold text-sm mb-1">Referral Tools Coming Soon</p>
          <p className="text-white/55 text-xs leading-relaxed">
            Your promo code, referral link, and QR code will appear here once your partner profile is activated.
            Reach out to your account manager to get set up.
          </p>
        </div>
        <div className="rounded-2xl bg-orange-950/30 border border-orange-900/30 p-4">
          <p className="text-[10px] text-orange-300/70 uppercase tracking-wider font-semibold mb-2">What you'll have access to</p>
          <ul className="space-y-2 text-xs text-white/60">
            <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">·</span> A personal promo code to share verbally, on podcasts, or in videos</li>
            <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">·</span> A trackable referral link for websites, emails, and social profiles</li>
            <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">·</span> A downloadable QR code for flyers, business cards, and presentations</li>
          </ul>
        </div>
      </div>
    );
  }

  const hasAnyTool = profile.promoCode || profile.referralUrl;

  return (
    <ProActionLock feature="access your promo code, referral link, and QR code">
    <div className="space-y-4">
      {/* Promo Code */}
      {profile.promoCode && (
        <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
          <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-2">
            Promo Code
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-2xl font-bold text-white tracking-wider">
              {profile.promoCode}
            </span>
            <CopyButton text={profile.promoCode} label="Copy Code" />
          </div>
          {profile.customerDiscount != null && (
            <p className="text-xs text-orange-300/80 mt-2">
              Gives customers {profile.customerDiscount}% off
            </p>
          )}
          <p className="text-xs text-white/35 mt-3 leading-relaxed">
            Use for podcasts, videos, live events, and verbal conversations.
          </p>
        </div>
      )}

      {/* Referral Link */}
      {profile.referralUrl && (
        <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
          <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-2">
            Referral Link
          </p>
          <p className="text-sm text-white/80 break-all mb-3 font-mono leading-relaxed">
            {profile.referralUrl}
          </p>
          <CopyButton text={profile.referralUrl} label="Copy Link" />
          <p className="text-xs text-white/35 mt-3 leading-relaxed">
            Use in websites, email signatures, social profiles, and text messages.
          </p>
        </div>
      )}

      {/* QR Code */}
      {(profile.referralUrl || profile.promoCode) && (
        <div className="rounded-2xl bg-black/40 border border-white/10 p-5">
          <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-3">
            QR Code
          </p>
          <div className="flex gap-4 items-start">
            {/* Preview */}
            <div className="w-32 h-32 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
              {qrLoading ? (
                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              ) : qrSrc ? (
                <img
                  src={qrSrc}
                  alt="Referral QR Code"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <QrCode className="h-10 w-10 text-gray-300" />
              )}
            </div>

            {/* Downloads */}
            <div className="flex-1 flex flex-col gap-2">
              <button
                onClick={() => downloadQr("png")}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-semibold hover:bg-orange-500/30 transition-colors active:scale-[0.97]"
              >
                <Download className="h-3.5 w-3.5" />
                Download PNG
              </button>
              <button
                onClick={() => downloadQr("svg")}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white/70 text-xs font-semibold hover:bg-white/15 transition-colors active:scale-[0.97]"
              >
                <Download className="h-3.5 w-3.5" />
                Download SVG
              </button>
              <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
                PNG for digital use. SVG scales losslessly for print.
              </p>
            </div>
          </div>
          <p className="text-xs text-white/35 mt-3 leading-relaxed">
            Use on flyers, business cards, posters, and presentations.
          </p>
        </div>
      )}

      {!hasAnyTool && (
        <div className="text-center py-8">
          <p className="text-white/50 text-sm">Your referral tools are being set up.</p>
          <p className="text-white/35 text-xs mt-1">
            Check back soon or contact your account manager.
          </p>
        </div>
      )}
    </div>
    </ProActionLock>
  );
}
