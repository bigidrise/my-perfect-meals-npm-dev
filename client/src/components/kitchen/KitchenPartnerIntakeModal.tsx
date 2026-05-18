// client/src/components/kitchen/KitchenPartnerIntakeModal.tsx
// Premium 5-step partnership intake modal for prospective Signature Kitchen partners.
// Collects: Identity → Culinary Identity → Platform Presence → Kitchen Interest → Submit.
// Does NOT do full onboarding — this is partnership discovery intake only.
// On submit: POST /api/kitchens/partner-inquiry (email sent server-side via Resend).

import { useState, useRef } from "react";
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

const PARTNERSHIP_OPTIONS: { value: PartnershipType; label: string; desc: string }[] = [
  { value: "signature_kitchen",   label: "Signature Kitchen",    desc: "Your personal branded kitchen inside the platform" },
  { value: "product_integration", label: "Product Integration",  desc: "Integrate your brand, products, or supplements" },
  { value: "white_label",         label: "White Label",          desc: "A fully branded platform experience" },
  { value: "restaurant_group",    label: "Restaurant Group",     desc: "Multi-location or franchise partnership" },
  { value: "athlete_kitchen",     label: "Athlete Kitchen",      desc: "Performance and sport-specific culinary identity" },
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
  { label: "Identity",         eyebrow: "01 of 05" },
  { label: "Culinary Identity",eyebrow: "02 of 05" },
  { label: "Platform",         eyebrow: "03 of 05" },
  { label: "Interest",         eyebrow: "04 of 05" },
  { label: "Submit",           eyebrow: "05 of 05" },
];

function Field({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
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
      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{label}</label>
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
        setErrorMsg(d.message || "Something went wrong. Please try again.");
        setSubmitState("error");
      }
    } catch {
      setErrorMsg("Unable to submit. Please check your connection and try again.");
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
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-orange-500/60">
                  Partnership Review
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">{STEPS[step].eyebrow} — {STEPS[step].label}</p>
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
                        <h2 className="text-xl font-bold text-white">Tell us about yourself.</h2>
                        <p className="text-xs text-white/35 leading-relaxed">Basic identity and contact information.</p>
                      </div>
                      <Field label="Full Name" value={form.fullName} onChange={set("fullName")} placeholder="Your full name" required />
                      <Field label="Chef / Brand Name" value={form.chefBrandName} onChange={set("chefBrandName")} placeholder="Your public culinary brand" />
                      <Field label="Email" value={form.email} onChange={set("email")} type="email" placeholder="you@yourdomain.com" required />
                      <Field label="Phone" value={form.phone} onChange={set("phone")} type="tel" placeholder="+1 (000) 000-0000" />
                      <Field label="Location" value={form.location} onChange={set("location")} placeholder="City, State / Country" />
                    </>
                  )}

                  {/* ── Step 1: Culinary Identity ── */}
                  {step === 1 && (
                    <>
                      <div className="space-y-1 mb-5">
                        <h2 className="text-xl font-bold text-white">Your culinary identity.</h2>
                        <p className="text-xs text-white/35 leading-relaxed">This shapes how your kitchen is built inside the platform.</p>
                      </div>
                      <Field label="Cuisine Focus" value={form.cuisineFocus} onChange={set("cuisineFocus")} placeholder="e.g. Southern, Japanese, Mediterranean" />
                      <Textarea label="Cooking Philosophy" value={form.cookingPhilosophy} onChange={set("cookingPhilosophy")}
                        placeholder="How would you describe your approach to food?" rows={3} />
                      <Field label="Signature Styles" value={form.signatureStyles} onChange={set("signatureStyles")}
                        placeholder="e.g. high-protein, comfort food, plant-forward" />
                      <Textarea label="Wellness Philosophy" value={form.wellnessPhilosophy} onChange={set("wellnessPhilosophy")}
                        placeholder="How does health and nutrition factor into your cooking?" rows={2} />
                    </>
                  )}

                  {/* ── Step 2: Platform Presence ── */}
                  {step === 2 && (
                    <>
                      <div className="space-y-1 mb-5">
                        <h2 className="text-xl font-bold text-white">Where is your audience?</h2>
                        <p className="text-xs text-white/35 leading-relaxed">Share your social and web presence. All fields optional.</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
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
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
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
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">TikTok</label>
                        <input type="url" value={form.tiktok} onChange={e => set("tiktok")(e.target.value)}
                          placeholder="https://tiktok.com/@yourhandle"
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none"
                          style={{ backgroundColor: "#ffffff08", border: "1px solid #ffffff14" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "#ea580c50"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "#ffffff14"; }} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                          <Globe className="h-3 w-3" /> Website
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
                        <h2 className="text-xl font-bold text-white">What interests you?</h2>
                        <p className="text-xs text-white/35 leading-relaxed">Select all that apply. You can have more than one.</p>
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
                                  {opt.label}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{opt.desc}</p>
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
                        <h2 className="text-xl font-bold text-white">Ready to submit.</h2>
                        <p className="text-xs text-white/35 leading-relaxed">
                          Our partnerships team reviews every application personally. You'll hear from us within 3–5 business days.
                        </p>
                      </div>

                      {/* Summary */}
                      <div className="rounded-xl p-4 space-y-2" style={{ background: "#ffffff06", border: "1px solid #ffffff10" }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Application Summary</p>
                        {form.fullName && <SummaryRow label="Name" value={form.fullName} />}
                        {form.chefBrandName && <SummaryRow label="Brand" value={form.chefBrandName} />}
                        {form.email && <SummaryRow label="Email" value={form.email} />}
                        {form.cuisineFocus && <SummaryRow label="Cuisine" value={form.cuisineFocus} />}
                        {form.partnershipTypes.length > 0 && (
                          <SummaryRow
                            label="Interest"
                            value={PARTNERSHIP_OPTIONS.filter(o => form.partnershipTypes.includes(o.value)).map(o => o.label).join(", ")}
                          />
                        )}
                      </div>

                      <div className="rounded-xl p-4" style={{ background: "#ea580c0d", border: "1px solid #ea580c22" }}>
                        <p className="text-xs text-white/40 leading-relaxed">
                          By submitting, you agree that My Perfect Meals may use the information you've provided to evaluate your partnership application. No commitments are made until a formal agreement is signed.
                        </p>
                      </div>

                      {errorMsg && (
                        <p className="text-xs text-red-400 text-center">{errorMsg}</p>
                      )}

                      <button type="button" onClick={handleSubmit} disabled={submitState === "submitting"}
                        className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
                        style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 8px 24px #ea580c30" }}>
                        {submitState === "submitting" ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                        ) : (
                          <><Wand2 className="h-4 w-4" /> Request Partnership Review</>
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
                        <h2 className="text-xl font-bold text-white">Application Received.</h2>
                        <p className="text-sm text-white/45 leading-relaxed max-w-xs">
                          Our partnerships team will review your application and reach out within 3–5 business days. We review every application personally.
                        </p>
                      </div>
                      <div className="rounded-xl px-5 py-3" style={{ background: "#ea580c0d", border: "1px solid #ea580c22" }}>
                        <p className="text-xs text-orange-400/70">
                          We'll contact you at <span className="font-semibold text-orange-300">{form.email}</span>
                        </p>
                      </div>
                      <button type="button" onClick={handleClose}
                        className="px-8 py-3 rounded-xl text-white/70 font-medium text-sm"
                        style={{ backgroundColor: "#ffffff0f", border: "1px solid #ffffff18" }}>
                        Done
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
                  Back
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
                    Next
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
      <span className="text-[11px] text-white/30 w-14 flex-shrink-0">{label}</span>
      <span className="text-[11px] text-white/60 min-w-0 break-words">{value}</span>
    </div>
  );
}
