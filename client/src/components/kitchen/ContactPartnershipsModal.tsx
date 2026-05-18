// client/src/components/kitchen/ContactPartnershipsModal.tsx
// Lightweight contact modal for general partnership inquiries.
// Fields: Name, Email, Company/Brand, Subject (dropdown), Message.
// POST /api/kitchens/contact-inquiry

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";

const SUBJECTS = [
  "Chef Partnership",
  "Supplement Brand",
  "Enterprise",
  "White Label",
  "Media / Press",
  "General Question",
];

type SubmitState = "idle" | "submitting" | "success" | "error";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ContactPartnershipsModal({ isOpen, onClose }: Props) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleClose() {
    onClose();
    setTimeout(() => {
      setName(""); setEmail(""); setCompany(""); setSubject(""); setMessage("");
      setSubmitState("idle"); setErrorMsg("");
    }, 400);
  }

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(apiUrl("/api/kitchens/contact-inquiry"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, subject, message }),
      });
      if (res.ok) {
        setSubmitState("success");
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.message || "Something went wrong. Please try again.");
        setSubmitState("error");
      }
    } catch {
      setErrorMsg("Unable to submit. Please check your connection.");
      setSubmitState("error");
    }
  }

  const canSubmit = !!name.trim() && !!email.trim() && !!message.trim();

  const inputStyle = {
    backgroundColor: "#ffffff08",
    border: "1px solid #ffffff14",
    caretColor: "#ea580c",
  };
  const inputClass = "w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all";

  function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = "#ea580c50";
  }
  function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = "#ffffff14";
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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
            style={{
              background: "linear-gradient(160deg, #0d0500 0%, #1c0900 50%, #080300 100%)",
              border: "1px solid #ea580c20",
              boxShadow: "0 -20px 60px #ea580c12, 0 -2px 0 #ea580c25",
              maxHeight: "88vh",
              paddingBottom: "env(safe-area-inset-bottom, 20px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-orange-500/90">
                  The Kitchen Network
                </p>
                <h2 className="text-lg font-bold text-white mt-1">Contact Partnerships</h2>
              </div>
              <button type="button" onClick={handleClose}
                className="p-1.5 rounded-full bg-white/8 text-white/40 active:scale-95 transition-transform">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
              <AnimatePresence mode="wait">
                {submitState === "success" ? (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center text-center py-10 gap-5">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: "#ea580c18", border: "1.5px solid #ea580c45" }}>
                      <CheckCircle2 className="h-8 w-8 text-orange-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white">Message Sent.</h3>
                      <p className="text-sm text-white/80 leading-relaxed max-w-xs">
                        Our partnerships team will respond within 48 hours.
                      </p>
                    </div>
                    <button type="button" onClick={handleClose}
                      className="px-8 py-3 rounded-xl text-white font-medium text-sm"
                      style={{ backgroundColor: "#ffffff0f", border: "1px solid #ffffff18" }}>
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="form" className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                        Name <span className="text-orange-500">*</span>
                      </label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Your full name" className={inputClass} style={inputStyle}
                        onFocus={focusBorder} onBlur={blurBorder} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                        Email <span className="text-orange-500">*</span>
                      </label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@yourdomain.com" className={inputClass} style={inputStyle}
                        onFocus={focusBorder} onBlur={blurBorder} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Company / Brand</label>
                      <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                        placeholder="Optional" className={inputClass} style={inputStyle}
                        onFocus={focusBorder} onBlur={blurBorder} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Subject</label>
                      <select value={subject} onChange={e => setSubject(e.target.value)}
                        className={inputClass} style={{ ...inputStyle, color: subject ? "white" : "rgba(255,255,255,0.25)" }}
                        onFocus={focusBorder} onBlur={blurBorder}>
                        <option value="" disabled style={{ backgroundColor: "#1a0800" }}>Select a topic</option>
                        {SUBJECTS.map(s => (
                          <option key={s} value={s} style={{ backgroundColor: "#1a0800", color: "white" }}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                        Message <span className="text-orange-500">*</span>
                      </label>
                      <textarea value={message} onChange={e => setMessage(e.target.value)}
                        placeholder="Tell us what you have in mind…" rows={4}
                        className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none transition-all"
                        style={inputStyle} onFocus={focusBorder} onBlur={blurBorder} />
                    </div>

                    {errorMsg && <p className="text-xs text-red-400 text-center">{errorMsg}</p>}

                    <button type="button" onClick={handleSubmit} disabled={!canSubmit || submitState === "submitting"}
                      className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-lg disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 8px 24px #ea580c30" }}>
                      {submitState === "submitting" ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      ) : (
                        <><Send className="h-4 w-4" /> Send Message</>
                      )}
                    </button>

                    <p className="text-center text-[10px] text-white/60">
                      Our team responds within 48 hours.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
