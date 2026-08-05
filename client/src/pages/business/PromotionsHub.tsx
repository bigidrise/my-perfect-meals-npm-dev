import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Copy, Check, Pause, Play, Trash2,
  Tag, Clock, Users, ChevronDown, ChevronUp, Zap, QrCode,
} from "lucide-react";
import QRCode from "qrcode";

type PromoType = "extended_trial" | "discount";
type PromoStatus = "active" | "paused" | "deleted";

interface Promotion {
  id: string;
  name: string;
  type: PromoType;
  trial_days: number | null;
  discount_percent: number | null;
  discount_duration: string | null;
  discount_months: number | null;
  max_uses: number | null;
  used_count: number;
  redemption_count: number;
  expires_at: string | null;
  invite_token: string;
  stripe_promo_code: string | null;
  status: PromoStatus;
  created_at: string;
}

function getInviteLink(token: string) {
  return `${window.location.origin}/join/promo/${token}`;
}

function promoSummary(p: Promotion) {
  if (p.type === "extended_trial") return `${p.trial_days}-day free access`;
  if (p.type === "discount") {
    const dur = p.discount_duration === "forever"
      ? "forever"
      : p.discount_duration === "once"
        ? "first payment"
        : `${p.discount_months} months`;
    return `${p.discount_percent}% off — ${dur}`;
  }
  return "";
}

async function generateQRDataUrl(link: string): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, link, {
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return canvas.toDataURL("image/png");
}

function triggerDownload(dataUrl: string, promoName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${promoName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_qr.png`;
  a.click();
}

function QRPreviewModal({ link, promoName, onClose }: { link: string; promoName: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Generate QR on mount
  useEffect(() => {
    generateQRDataUrl(link).then(setDataUrl);
  }, [link]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = dataUrl ?? await generateQRDataUrl(link);
      triggerDownload(url, promoName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.18 }}
        className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center gap-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-orange-400" />
            <p className="text-sm font-semibold text-white">QR Code</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-white/50 text-center -mt-1 w-full truncate">{promoName}</p>

        {/* QR preview */}
        <div className="w-56 h-56 rounded-xl bg-white flex items-center justify-center overflow-hidden">
          {dataUrl
            ? <img src={dataUrl} alt="QR Code" className="w-full h-full object-contain" />
            : <div className="w-8 h-8 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
          }
        </div>

        <p className="text-[11px] text-white/30 text-center">Scan to verify it opens the invite link</p>

        <button
          onClick={handleDownload}
          disabled={!dataUrl || downloading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <QrCode className="w-4 h-4" />
          {downloading ? "Saving…" : "Download PNG"}
        </button>
      </motion.div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
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
      className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function PromoCard({ promo, onStatusChange, onDelete }: {
  promo: Promotion;
  onStatusChange: (id: string, status: "active" | "paused") => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const link = getInviteLink(promo.invite_token);
  const isActive = promo.status === "active";

  return (
    <div className={`rounded-2xl border transition-all ${isActive ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 opacity-60"}`}>
      <button className="w-full text-left p-4" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                promo.type === "extended_trial"
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              }`}>
                {promo.type === "extended_trial" ? "Trial" : "Discount"}
              </span>
              {!isActive && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-white/40">
                  Paused
                </span>
              )}
            </div>
            <p className="font-semibold text-white text-sm">{promo.name}</p>
            <p className="text-xs text-white/50 mt-0.5">{promoSummary(promo)}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-white">{promo.redemption_count}</p>
              <p className="text-[10px] text-white/40">used{promo.max_uses ? ` / ${promo.max_uses}` : ""}</p>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {/* Invite link */}
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Invite Link</p>
                <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2">
                  <p className="text-xs text-white/60 flex-1 truncate">{link}</p>
                  <CopyButton text={link} />
                </div>
              </div>

              {/* Stripe promo code (discount type) */}
              {promo.stripe_promo_code && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Promo Code</p>
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2">
                    <p className="text-xs text-amber-400 font-mono font-bold flex-1">{promo.stripe_promo_code}</p>
                    <CopyButton text={promo.stripe_promo_code} />
                  </div>
                </div>
              )}

              {/* Expiry */}
              {promo.expires_at && (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <Clock className="w-3.5 h-3.5" />
                  Expires {new Date(promo.expires_at).toLocaleDateString()}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <DownloadQRButton link={link} promoName={promo.name} />
                <button
                  onClick={() => onStatusChange(promo.id, isActive ? "paused" : "active")}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
                >
                  {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isActive ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => onDelete(promo.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreatePromotionForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PromoType>("extended_trial");
  const [trialDays, setTrialDays] = useState(30);
  const [discountPercent, setDiscountPercent] = useState(30);
  const [discountDuration, setDiscountDuration] = useState<"once" | "repeating" | "forever">("forever");
  const [discountMonths, setDiscountMonths] = useState(3);
  const [maxUses, setMaxUses] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/promotions", {
        method: "POST",
        body: JSON.stringify({
          name, type,
          ...(type === "extended_trial" && { trialDays }),
          ...(type === "discount" && { discountPercent, discountDuration, discountMonths }),
          ...(maxUses !== "" && { maxUses: Number(maxUses) }),
          ...(expiresAt && { expiresAt }),
        }),
      });
    },
    onSuccess: () => onSuccess(),
    onError: (err: any) => setError(err.message || "Failed to create promotion"),
  });

  return (
    <div className="bg-black/40 rounded-2xl border border-white/10 p-5">
      <h3 className="font-bold text-white mb-4">New Promotion</h3>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wide mb-1 block">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Dr. Amy Patient Promotion"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
          />
        </div>

        {/* Type toggle */}
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wide mb-2 block">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(["extended_trial", "discount"] as PromoType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                  type === t
                    ? "bg-orange-600 text-white"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {t === "extended_trial" ? "🕐 Extended Trial" : "💰 Discount"}
              </button>
            ))}
          </div>
        </div>

        {/* Trial params */}
        {type === "extended_trial" && (
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wide mb-1 block">Free Days</label>
            <div className="flex gap-2">
              {[7, 30, 60, 90, 180].map(d => (
                <button
                  key={d}
                  onClick={() => setTrialDays(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    trialDays === d ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-1.5">Users get {trialDays} days of full access, no card required.</p>
          </div>
        )}

        {/* Discount params */}
        {type === "discount" && (
          <>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wide mb-1 block">Discount</label>
              <div className="flex gap-2">
                {[10, 20, 25, 30, 50].map(p => (
                  <button
                    key={p}
                    onClick={() => setDiscountPercent(p)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                      discountPercent === p ? "bg-amber-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wide mb-1 block">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {(["once", "repeating", "forever"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDiscountDuration(d)}
                    className={`py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                      discountDuration === d ? "bg-amber-600 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {d === "repeating" ? "Multi-month" : d}
                  </button>
                ))}
              </div>
              {discountDuration === "repeating" && (
                <div className="mt-2">
                  <label className="text-xs text-white/40 mb-1 block">How many months?</label>
                  <input
                    type="number"
                    value={discountMonths}
                    min={1}
                    max={24}
                    onChange={e => setDiscountMonths(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Optional limits */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wide mb-1 block">Max Uses (optional)</label>
            <input
              type="number"
              value={maxUses}
              min={1}
              placeholder="Unlimited"
              onChange={e => setMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wide mb-1 block">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-white/5 text-white/60 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            disabled={!name || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex-1 py-3 rounded-2xl bg-orange-600 text-white text-sm font-bold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {mutation.isPending ? "Creating…" : "Create Promotion"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromotionsHub() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<{ promotions: Promotion[] }>({
    queryKey: ["/api/promotions"],
    queryFn: () => apiRequest("/api/promotions"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      apiRequest(`/api/promotions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/promotions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/promotions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/promotions"] }),
  });

  const promotions = data?.promotions ?? [];
  const active = promotions.filter(p => p.status === "active");
  const paused = promotions.filter(p => p.status === "paused");

  return (
    <div className={`bg-gradient-to-br from-black/60 via-gray-900 to-black/80 text-white ${isDesktop ? "min-h-0 pb-8" : "min-h-screen pb-24"}`}>
      <div className={`px-4 max-w-2xl mx-auto ${isDesktop ? "pt-6" : "pt-14"}`}>

        {isDesktop && (
          <button
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 text-orange-400 text-sm font-medium mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Center
          </button>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Promotions</h1>
            <p className="text-sm text-white/50 mt-0.5">Create offers for patients, clients, or campaigns</p>
          </div>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-600 text-white text-sm font-bold active:scale-[0.98] transition-transform"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          )}
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <CreatePromotionForm
                onSuccess={() => {
                  setShowCreate(false);
                  qc.invalidateQueries({ queryKey: ["/api/promotions"] });
                }}
                onCancel={() => setShowCreate(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works — shown when empty */}
        {!isLoading && promotions.length === 0 && !showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center mb-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="font-bold text-white mb-2">Your Promotion Engine</h3>
            <p className="text-sm text-white/50 max-w-sm mx-auto">
              Create trial extensions or discount codes for your patients, clients, and campaigns.
              Each promotion generates a unique invite link you can share anywhere.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-left">
              {[
                { icon: Clock, title: "Extended Trial", desc: "Give 30, 60, or 90 days of full access" },
                { icon: Tag, title: "Discount Code", desc: "Apply % off at Stripe checkout automatically" },
                { icon: Users, title: "Usage Limits", desc: "Set max redemptions per promotion" },
                { icon: Copy, title: "Shareable Link", desc: "One link — share via email, text, or QR" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white/5 rounded-xl p-3">
                  <Icon className="w-4 h-4 text-orange-400 mb-1" />
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Active promotions */}
        {active.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Active</p>
            <div className="space-y-3">
              {active.map(p => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                  onDelete={id => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Paused promotions */}
        {paused.length > 0 && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Paused</p>
            <div className="space-y-3">
              {paused.map(p => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                  onDelete={id => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DownloadQRButton({ link, promoName }: { link: string; promoName: string }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
      >
        <QrCode className="w-3.5 h-3.5" />
        QR Code
      </button>
      <AnimatePresence>
        {showModal && (
          <QRPreviewModal link={link} promoName={promoName} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
