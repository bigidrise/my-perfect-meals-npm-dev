// client/src/components/kitchen/KitchenPartnerIntakeModal.tsx
// Premium 5-step partnership intake modal for prospective Signature Kitchen partners.
// Collects: Identity → Culinary Identity → Platform Presence → Kitchen Interest → Submit.
// Does NOT do full onboarding — this is partnership discovery intake only.
// On submit: POST /api/kitchens/partner-inquiry (email sent server-side via Resend).

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronLeft, ChevronRight, ChefHat, Globe, Sparkles,
  Instagram, Youtube, Wand2, CheckCircle2, Loader2,
} from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";

type PartnershipType =
  | "signature_kitchen"
  | "product_integration"
  | "white_label"
  | "restaurant_group"
  | "athlete_kitchen";

const PARTNERSHIP_OPTIONS: { value: PartnershipType; labelKey: string; descKey: string }[] = [
  { value: "signature_kitchen",   labelKey: "kitchenPartner.optSignatureLabel",   descKey: "kitchenPartner.optSignatureDesc" },
  { value: "product_integration", labelKey: "kitchenPartner.optProductLabel",     descKey: "kitchenPartner.optProductDesc" },
  { value: "white_label",         labelKey: "kitchenPartner.optWhiteLabelLabel",  descKey: "kitchenPartner.optWhiteLabelDesc" },
  { value: "restaurant_group",    labelKey: "kitchenPartner.optRestaurantLabel",  descKey: "kitchenPartner.optRestaurantDesc" },
  { value: "athlete_kitchen",     labelKey: "kitchenPartner.optAthleteLabel",     descKey: "kitchenPartner.optAthleteDesc" },
];

type FormData = {
  fullName: string;
  chefBrandName: string;
  email: string;
  phone: string;
  location: string;
  cuisineFocus: string;
  cookingPhilosophy: string;
  signatureStyles: string;
  wellnessPhilosophy: string;
  youtube: string;
  instagram: string;
  tiktok: string;
  website: string;
  partnershipTypes: PartnershipType[];
};

const EMPTY: FormData = {
  fullName: "", chefBrandName: "", email: "", phone: "", location: "",
  cuisineFocus: "", cookingPhilosophy: "", signatureStyles: "", wellnessPhilosophy: "",
  youtube: "", instagram: "", tiktok: "", website: "",
  partnershipTypes: [],
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const STEPS = [
  { labelKey: "kitchenPartner.stepIdentity",  eyebrow: "01 of 05" },
  { labelKey: "kitchenPartner.stepCulinary",  eyebrow: "02 of 05" },
  { labelKey: "kitchenPartner.stepPlatform",  eyebrow: "03 of 05" },
  { labelKey: "kitchenPartner.stepInterest",  eyebrow: "04 of 05" },
  { labelKey: "kitchenPartner.stepSubmit",    eyebrow: "05 of 05" },
];

function Field({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
        {label}{required && <span className="text-orange-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all"
        style={{
          backgroundColor: "#ffffff08",
          border: "1px solid #ffffff14",
          caretColor: "#ea580c",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "#ea580c50"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "#ffffff14"; }}
      />
    </div>
  );
}

function Textarea({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none transition-all"
        style={{
          backgroundColor: "#ffffff08",
          border: "1px solid #ffffff14",
          caretColor: "#ea580c",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "#ea580c50"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "#ffffff14"; }}
      />
    </div>
  );
}

export default function KitchenPartnerIntakeModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const [step, setStep]         = useState(0);
  const [form, setForm]         = useState<FormData>(EMPTY);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const progress = ((step + 1) / STEPS.length) * 100;
  const isFirst  = step === 0;
  const isLast   = step === STEPS.length - 1;

  function set(key: keyof FormData) {
    return (v: string) => setForm(prev => ({ ...prev, [key]: v }));
  }

  function togglePartnership(val: PartnershipType) {
    setForm(prev => {
      const has = prev.partnershipTypes.includes(val);
      return {
        ...prev,
        partnershipTypes: has
          ? prev.partnershipTypes.filter(p => p !== val)
          : [...prev.partnershipTypes, val],
      };
    });
  }

  function canAdvance(): boolean {
    if (step === 0) return !!form.fullName.trim() && !!form.email.trim();
    if (step === 3) return form.partnershipTypes.length > 0;
    return true;
  }

  function goNext() {
    if (!canAdvance()) return;
    setStep(s => s + 1);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }
  function goBack() {
    setStep(s => s - 1);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }

  async function handleSubmit() {
    if (!form.fullName.trim() || !form.email.trim()) return;
    setSubmitState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(apiUrl("/api/kitchens/partner-inquiry"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitState("success");
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.message || t("kitchenPartner.errorGeneric"));
        setSubmitState("error");
      }
    } catch {
      setErrorMsg(t("kitchenPartner.errorConnection"));
      setSubmitState("error");
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep(0);
      setForm(EMPTY);
      setSubmitState("idle");
      setErrorMsg("");
    }, 400);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col"
            style={{
              background: "linear-gradient(160deg, #0d0500 0%, #1c0900 50%, #080300 100%)",
              border: "1px solid #ea580c20",
              boxShadow: "0 -20px 60px #ea580c12, 0 -2px 0 #ea580c25",
              maxHeight: "92vh",
              paddingBottom: "env(safe-area-inset-bottom, 20px)",
            }}
          >
            {/* Progress */}
            <div className="h-0.5 w-full bg-white/5 flex-shrink-0">
              <motion.div className="h-full bg-orange-500"
                initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35 }} />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-orange-500/90">
                  {t("kitchenPartner.partnershipReview")}
                </p>
                <p className="text-[11px] text-white/70 mt-0.5">{STEPS[step].eyebrow} — {t(STEPS[step].labelKey)}</p>
              </div>
              <button type="button" onClick={handleClose}
                className="p-1.5 rounded-full bg-white/8 text-white/40 active:scale-95 transition-transform">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-4">
              <AnimatePresence mode="wait">
                <motion.div key={step}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pt-1"
                >

                  {/* ── Step 0: Identity ── */}
                  {step === 0 && (
                    <>
                      <div className="space-y-1 mb-5">
                        <h2 className="text-xl font-bold text-white">{t("kitchenPartner.identityHeading")}</h2>
                        <p className="text-xs text-white/70 leading-relaxed">{t("kitchenPartner.identitySub")}</p>
                      </div>
                      <Field label={t("kitchenPartner.fullNameLabel")} value={form.fullName} onChange={set("fullName")} placeholder={t("kitchenPartner.fullNamePlaceholder")} required />
                      <Field label={t("kitchenPartner.brandLabel")} value={form.chefBrandName} onChange={set("chefBrandName")} placeholder={t("kitchenPartner.brandPlaceholder")} />
                      <Field label={t("kitchenPartner.emailLabel")} value={form.email} onChange={set("email")} type="email" placeholder="you@yourdomain.com" required />
                      <Field label={t("kitchenPartner.phoneLabel")} value={form.phone} onChange={set("phone")} type="tel" placeholder="+1 (000) 000-0000" />
                      <Field label={t("kitchenPartner.locationLabel")} value={form.location} onChange={set("location")} placeholder={t("kitchenPartner.locationPlaceholder")} />
                    </>
                  )}

                  {/* ── Step 1: Culinary Identity ── */}
                  {step === 1 && (
                    <>
                      <div className="space-y-1 mb-5">
                        <h2 className="text-xl font-bold text-white">{t("kitchenPartner.culinaryHeading")}</h2>
                        <p className="text-xs text-white/70 leading-relaxed">{t("kitchenPartner.culinarySub")}</p>
                      </div>
                      <Field label={t("kitchenPartner.cuisineFocusLabel")} value={form.cuisineFocus} onChange={set("cuisineFocus")} placeholder={t("kitchenPartner.cuisineFocusPlaceholder")} />
                      <Textarea label={t("kitchenPartner.cookingPhilosophyLabel")} value={form.cookingPhilosophy} onChange={set("cookingPhilosophy")}
                        placeholder={t("kitchenPartner.cookingPhilosophyPlaceholder")} rows={3} />
                      <Field label={t("kitchenPartner.signatureStylesLabel")} value={form.signatureStyles} onChange={set("signatureStyles")}
                        placeholder={t("kitchenPartner.signatureStylesPlaceholder")} />
                      <Textarea label={t("kitchenPartner.wellnessPhilosophyLabel")} value={form.wellnessPhilosophy} onChange={set("wellnessPhilosophy")}
                        placeholder={t("kitchenPartner.wellnessPhilosophyPlaceholder")} rows={2} />
                    </>
                  )}

                  {/* ── Step 2: Platform Presence ── */}
                  {step === 2 && (
                    <>
                      <div className="space-y-1 mb-5">
                        <h2 className="text-xl font-bold text-white">{t("kitchenPartner.platformHeading")}</h2>
                        <p className="text-xs text-white/70 leading-relaxed">{t("kitchenPartner.platformSub")}</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-1.5">
                          <Youtube className="h-3 w-3" /> YouTube
                        </label>
                        <input type="url" value={form.youtube} onChange={e => set("youtube")(e.target.value)}
                          placeholder="https://youtube.com/@yourchannel"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                          style={{ backgroundColor: "#ffffff08", border: "1px solid #ffffff14" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "#ea580c50"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "#ffffff14"; }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-1.5">
                          <Instagram className="h-3 w-3" /> Instagram
                        </label>
                        <input type="url" value={form.instagram} onChange={e => set("instagram")(e.target.value)}
                          placeholder="https://instagram.com/yourhandle"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                          style={{ backgroundColor: "#ffffff08", border: "1px solid #ffffff14" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "#ea580c50"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "#ffffff14"; }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">TikTok</label>
                        <input type="url" value={form.tiktok} onChange={e => set("tiktok")(e.target.value)}
                          placeholder="https://tiktok.com/@yourhandle"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                          style={{ backgroundColor: "#ffffff08", border: "1px solid #ffffff14" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "#ea580c50"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "#ffffff14"; }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80 flex items-center gap-1.5">
                          <Globe className="h-3 w-3" /> {t("kitchenPartner.websiteLabel")}
                        </label>
                        <input type="url" value={form.website} onChange={e => set("website")(e.target.value)}
                          placeholder="https://yourwebsite.com"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                          style={{ backgroundColor: "#ffffff08", border: "1px solid #ffffff14" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "#ea580c50"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "#ffffff14"; }} />
                      </div>
                    </>
                  )}

                  {/* ── Step 3: Kitchen Interest ── */}
                  {step === 3 && (
                    <>
                      <div className="space-y-1 mb-5">
                        <h2 className="text-xl font-bold text-white">{t("kitchenPartner.interestHeading")}</h2>
                        <p className="text-xs text-white/70 leading-relaxed">{t("kitchenPartner.interestSub")}</p>
                      </div>
                      <div className="space-y-2.5">
                        {PARTNERSHIP_OPTIONS.map(opt => {
                          const selected = form.partnershipTypes.includes(opt.value);
                          return (
                            <button key={opt.value} type="button" onClick={() => togglePartnership(opt.value)}
                              className="w-full flex items-start gap-3 rounded-xl p-4 text-left transition-all active:scale-[0.99]"
                              style={{
                                background: selected ? "linear-gradient(135deg, #ea580c18 0%, #7c2d1210 100%)" : "#ffffff06",
                                border: selected ? "1.5px solid #ea580c50" : "1px solid #ffffff10",
                              }}>
                              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ borderColor: selected ? "#ea580c" : "#ffffff25", backgroundColor: selected ? "#ea580c" : "transparent" }}>
                                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <div>
                                <p className="text-sm font-semibold" style={{ color: selected ? "#fb923c" : "rgba(255,255,255,0.75)" }}>
                                  {t(opt.labelKey)}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{t(opt.descKey)}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* ── Step 4: Submit ── */}
                  {step === 4 && submitState !== "success" && (
                    <>
                      <div className="space-y-1 mb-5">
                        <h2 className="text-xl font-bold text-white">{t("kitchenPartner.readyHeading")}</h2>
                        <p className="text-xs text-white/70 leading-relaxed">
                          {t("kitchenPartner.readySub")}
                        </p>
                      </div>

                      {/* Summary */}
                      <div className="rounded-xl p-4 space-y-2" style={{ background: "#ffffff06", border: "1px solid #ffffff10" }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/65">{t("kitchenPartner.summaryHeading")}</p>
                        {form.fullName && <SummaryRow label={t("kitchenPartner.summaryName")} value={form.fullName} />}
                        {form.chefBrandName && <SummaryRow label={t("kitchenPartner.summaryBrand")} value={form.chefBrandName} />}
                        {form.email && <SummaryRow label={t("kitchenPartner.summaryEmail")} value={form.email} />}
                        {form.cuisineFocus && <SummaryRow label={t("kitchenPartner.summaryCuisine")} value={form.cuisineFocus} />}
                        {form.partnershipTypes.length > 0 && (
                          <SummaryRow
                            label={t("kitchenPartner.summaryInterest")}
                            value={PARTNERSHIP_OPTIONS.filter(o => form.partnershipTypes.includes(o.value)).map(o => t(o.labelKey)).join(", ")}
                          />
                        )}
                      </div>

                      <div className="rounded-xl p-4" style={{ background: "#ea580c0d", border: "1px solid #ea580c22" }}>
                        <p className="text-xs text-white/70 leading-relaxed">
                          {t("kitchenPartner.consentText")}
                        </p>
                      </div>

                      {errorMsg && (
                        <p className="text-xs text-red-400 text-center">{errorMsg}</p>
                      )}

                      <button type="button" onClick={handleSubmit} disabled={submitState === "submitting"}
                        className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
                        style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 8px 24px #ea580c30" }}>
                        {submitState === "submitting" ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> {t("kitchenPartner.submitting")}</>
                        ) : (
                          <><Wand2 className="h-4 w-4" /> {t("kitchenPartner.requestReview")}</>
                        )}
                      </button>
                    </>
                  )}

                  {/* ── Success ── */}
                  {submitState === "success" && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center text-center py-8 gap-5">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #ea580c22 0%, #7c2d1215 100%)", border: "1.5px solid #ea580c50" }}>
                        <CheckCircle2 className="h-8 w-8 text-orange-400" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-xl font-bold text-white">{t("kitchenPartner.successHeading")}</h2>
                        <p className="text-sm text-white/80 leading-relaxed max-w-xs">
                          {t("kitchenPartner.successSub")}
                        </p>
                      </div>
                      <div className="rounded-xl px-5 py-3" style={{ background: "#ea580c0d", border: "1px solid #ea580c22" }}>
                        <p className="text-xs text-orange-400/70">
                          {t("kitchenPartner.contactAt")} <span className="font-semibold text-orange-300">{form.email}</span>
                        </p>
                      </div>
                      <button type="button" onClick={handleClose}
                        className="px-8 py-3 rounded-xl text-white font-medium text-sm"
                        style={{ backgroundColor: "#ffffff0f", border: "1px solid #ffffff18" }}>
                        {t("kitchenPartner.done")}
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Nav footer — hidden on success */}
            {submitState !== "success" && (
              <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-t border-white/5">
                <button type="button" onClick={goBack} disabled={isFirst}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95 disabled:opacity-20"
                  style={{ backgroundColor: "#ffffff0f", color: "rgba(255,255,255,0.65)" }}>
                  <ChevronLeft className="h-4 w-4" />
                  {t("kitchenPartner.back")}
                </button>

                {/* Step dots */}
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <div key={i} className="transition-all rounded-full"
                      style={{
                        width: i === step ? 20 : 6, height: 6,
                        backgroundColor: i === step ? "#ea580c" : i < step ? "#ea580c60" : "#ffffff20",
                      }} />
                  ))}
                </div>

                {isLast ? (
                  // Submit is handled by the button inside the step
                  <div className="w-20" />
                ) : (
                  <button type="button" onClick={goNext} disabled={!canAdvance()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-30"
                    style={{ backgroundColor: canAdvance() ? "#ea580c" : "#ffffff15", color: "#fff" }}>
                    {t("kitchenPartner.next")}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[11px] text-white/60 w-14 flex-shrink-0">{label}</span>
      <span className="text-[11px] text-white min-w-0 break-words">{value}</span>
    </div>
  );
}
