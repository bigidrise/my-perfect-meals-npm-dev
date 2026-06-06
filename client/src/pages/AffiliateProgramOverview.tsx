import { useLocation } from "wouter";
import { ArrowLeft, DollarSign, Clock, TrendingUp, Users, ShieldCheck, ChevronRight, CheckCircle2, XCircle, Stethoscope, Briefcase } from "lucide-react";
import { motion } from "framer-motion";

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      className="p-5 rounded-2xl bg-black/30 backdrop-blur-lg border border-white/10 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {children}
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/50 flex-1">{label}</span>
      <span className="text-xs font-semibold text-orange-300 text-right flex-shrink-0">{value}</span>
    </div>
  );
}

export default function AffiliateProgramOverview() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">Affiliate Program</h1>
            <p className="text-xs text-white/40">How it works — read before you apply</p>
          </div>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Hero */}
        <motion.div
          className="text-center py-4 space-y-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">My Perfect Meals</p>
          <h1 className="text-2xl font-black text-white leading-tight">Affiliate Program Overview</h1>
          <p className="text-sm text-white/50 leading-relaxed max-w-sm mx-auto">
            Understand the economics before you activate. No surprises, no fine print buried at the end.
          </p>
        </motion.div>

        {/* Commission Structure */}
        <Section title="Commission Structure" delay={0.05}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Earn a percentage of qualifying subscription payments for every active customer you refer.
            </p>
          </div>
          <Row label="Commission rate" value="30% on qualifying payments" />
          <Row label="Commission period" value="First 24 months per customer" />
          <Row label="After 24 months" value="Commissions on that customer end" />
          <Row label="Customer cap" value="None — refer as many as you can" />
          <p className="text-xs text-white/30 pt-1 leading-relaxed">
            The commission window starts from the date each referred customer subscribes, not from when you joined the program.
          </p>
        </Section>

        {/* Earnings Example */}
        <Section title="What You Can Earn — Example" delay={0.08}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              If you refer 10 customers each paying $29.99/month:
            </p>
          </div>
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 space-y-2">
            <Row label="Your commission per customer" value="~$9/month" />
            <Row label="Monthly total (10 customers)" value="~$90/month" />
            <Row label="Duration" value="Up to 24 months while they stay active" />
            <Row label="Maximum from this group" value="~$2,160 over 24 months" />
          </div>
          <p className="text-xs text-white/30 leading-relaxed">
            Commissions are paid on active, qualifying subscriptions only. Refunded or cancelled months do not qualify.
          </p>
        </Section>

        {/* Why 24 Months */}
        <Section title="Why 24 Months?" delay={0.11}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Most affiliate and sales commission programs pay once, or for one year at most. Here is how ours compares.
            </p>
          </div>
          <div className="space-y-2">
            {[
              { label: "Typical one-time sales commission", value: "Single payment" },
              { label: "Most SaaS affiliate programs", value: "12 months or less" },
              { label: "My Perfect Meals", value: "24 months per customer" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-xs text-white/50">{item.label}</span>
                <span className={`text-xs font-semibold ${item.label.includes("My Perfect") ? "text-orange-400" : "text-white/30"}`}>{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40 leading-relaxed pt-1">
            The 24-month structure rewards you for bringing quality customers — and allows us to keep investing in the platform you are promoting.
          </p>
        </Section>

        {/* Successful vs unsuccessful */}
        <Section title="What Actually Works" delay={0.14}>
          <div className="flex items-center gap-3 pb-1">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Based on what successful affiliates consistently do — and what doesn't work.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Works</p>
              {[
                "Use the product yourself",
                "Share real results",
                "Create educational content",
                "Refer people who are a good fit",
                "Stay active and engaged",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-white/60 leading-snug">{item}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Doesn't Work</p>
              {[
                "Spam links with no context",
                "Make exaggerated claims",
                "Ignore compliance rules",
                "Focus only on quick sales",
                "Misrepresent the platform",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-white/60 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* For Coaches & Physicians */}
        <Section title="For Coaches & Physicians" delay={0.17}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Coaches and physicians earn in two distinct ways. Understanding both matters.
            </p>
          </div>
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-orange-400" />
                <p className="text-xs font-bold text-white">Direct Revenue</p>
              </div>
              <p className="text-xs text-white/50 leading-relaxed pl-6">
                Revenue from your coaching, training, consulting, or medical services. This is typically where professionals earn the most.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-400" />
                <p className="text-xs font-bold text-white">Affiliate Revenue</p>
              </div>
              <p className="text-xs text-white/50 leading-relaxed pl-6">
                Commissions earned when clients subscribe through your referral link. A supplement to your primary income, not a replacement.
              </p>
            </div>
          </div>
          <p className="text-xs text-white/30 leading-relaxed">
            Most coaches and physicians will earn significantly more from their core practice than from affiliate commissions. Both are valuable — just understand the difference.
          </p>
        </Section>

        {/* Compliance Policy */}
        <Section title="Compliance Requirements" delay={0.20}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              These are the same standards we hold ourselves to. Affiliates are an extension of this brand.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
            <p className="text-xs text-white/70 leading-relaxed">
              Affiliates may not make claims regarding weight loss, disease treatment, disease prevention, guaranteed results, or any outcome not supported by the platform.
            </p>
            <p className="text-xs text-white/70 leading-relaxed">
              Affiliates must follow My Perfect Meals marketing guidelines. Violations may result in suspension or termination of affiliate privileges.
            </p>
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] text-amber-400 font-bold">1</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="font-semibold text-amber-400">First violation:</span> Written warning and correction period.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] text-red-400 font-bold">2</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="font-semibold text-red-400">Second violation:</span> Affiliate account terminated.
              </p>
            </div>
          </div>
        </Section>

        {/* CTA */}
        <motion.div
          className="space-y-3 pt-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <button
            onClick={() => setLocation("/business-center/affiliate/choose")}
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span>Choose Your Affiliate Path</span>
            <ChevronRight className="h-5 w-5" />
          </button>
          <p className="text-center text-xs text-white/25 leading-relaxed px-4">
            By continuing you confirm you have read and understood the commission structure, earnings expectations, and compliance requirements above.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
