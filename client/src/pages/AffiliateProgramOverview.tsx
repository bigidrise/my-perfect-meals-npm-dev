import { useState, useEffect } from "react";
import { BC_HEADER } from "@/components/BusinessCenterShell";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useLocation } from "wouter";
import { FeatureUpgradeModal } from "@/components/modals/FeatureUpgradeModal";
import { useAuth } from "@/contexts/AuthContext";
import { isProOrAbove } from "@/lib/subscriptionCheck";
import {
  ArrowLeft, DollarSign, Clock, TrendingUp, Users, ShieldCheck,
  ChevronRight, CheckCircle2, XCircle, Stethoscope, Briefcase, Calculator,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

const COMMISSION_RATE = 0.30;

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3"
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
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/10 last:border-0">
      <span className="text-xs text-gray-400 flex-1">{label}</span>
      <span className="text-xs font-semibold text-right flex-shrink-0 text-orange-400">{value}</span>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function EarningsCalculator() {
  const [referrals, setReferrals] = useState(10);
  const [subValue, setSubValue] = useState(29.99);

  const monthly = referrals * subValue * COMMISSION_RATE;
  const twelveMonth = monthly * 12;
  const twentyFourMonth = monthly * 24;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-1">
        <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
          <Calculator className="h-5 w-5 text-orange-400" />
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Adjust the numbers to see what your commissions could look like. These are estimates based on active subscribers only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            Referrals
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={referrals}
            onChange={(e) => setReferrals(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
          />
          <p className="text-[10px] text-gray-500">number of customers</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            Avg. Sub Value
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min={1}
              max={999}
              step={0.01}
              value={subValue}
              onChange={(e) => setSubValue(Math.max(1, parseFloat(e.target.value) || 1))}
              className="w-full pl-6 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm font-semibold focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <p className="text-[10px] text-gray-500">per month / per subscriber</p>
        </div>
      </div>

      <div className="rounded-xl bg-orange-500/20 border border-orange-500/30 p-4 space-y-1">
        <Row label="Monthly commission" value={fmt(monthly)} />
        <Row label="12-month earnings" value={fmt(twelveMonth)} />
        <Row label="24-month earnings (full term)" value={fmt(twentyFourMonth)} />
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Assumes all referred customers remain active for the full period. Actual earnings depend on subscriber retention, plan type, and qualifying payment status.
      </p>
    </div>
  );
}

interface AffiliateAccount {
  affiliateTrack?: string;
  isActive?: boolean;
  activatedAt?: string | null;
  requiredPhases?: string | null;
  phase1CompletedAt?: string | null;
  phase2CompletedAt?: string | null;
}

function StatusPanel({
  acct,
  onDashboard,
  dashboardLoading = false,
  onContinueAcademy,
}: {
  acct: AffiliateAccount | null;
  onDashboard: () => void;
  dashboardLoading?: boolean;
  onContinueAcademy: () => void;
}) {
  const isActive = acct?.isActive || !!acct?.activatedAt;
  const academyComplete = !!acct?.phase1CompletedAt;
  const hasTrack = !!acct?.affiliateTrack;

  const dot = (active: boolean, partial?: boolean) => (
    <div
      className={`h-4 w-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
        active
          ? "bg-green-500 border-green-500"
          : partial
          ? "border-orange-400"
          : "border-gray-600"
      }`}
    >
      {active && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );

  return (
    <motion.div
      className="p-4 rounded-2xl border space-y-3"
      style={{
        backgroundColor: isActive ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.04)",
        borderColor: isActive ? "rgba(249,115,22,0.35)" : "rgba(255,255,255,0.12)",
      }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Your Partner Status</p>

      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          {dot(academyComplete, hasTrack && !academyComplete)}
          <span className={`text-sm ${academyComplete ? "text-white" : hasTrack ? "text-white/70" : "text-gray-500"}`}>
            {academyComplete ? "Academy Completed" : hasTrack ? "Academy In Progress" : "Academy: Not Started"}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {dot(isActive)}
          <span className={`text-sm ${isActive ? "text-white" : "text-gray-500"}`}>
            {isActive ? "Partner Account Active" : "Partner Account: Not Active"}
          </span>
        </div>
        {isActive && (
          <div className="flex items-center justify-between pt-1 border-t border-white/10 mt-1">
            <span className="text-xs text-gray-400">Commission Rate</span>
            <span className="text-xs font-bold text-orange-400">30% per active subscriber</span>
          </div>
        )}
        {!isActive && !hasTrack && !academyComplete && (
          <p className="text-xs text-gray-500 leading-relaxed pt-1">
            Complete the Academy to activate your partner account.
          </p>
        )}
      </div>

      {(isActive || academyComplete) && (
        <button
          onClick={onDashboard}
          disabled={dashboardLoading}
          className="w-full p-3 rounded-xl bg-orange-600 text-white text-sm font-bold flex items-center justify-between active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {dashboardLoading ? (
            <>
              <span>Opening Dashboard…</span>
              <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            </>
          ) : (
            <>
              <span>Open Partner Dashboard</span>
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      )}

      {hasTrack && !academyComplete && (
        <button
          onClick={onContinueAcademy}
          className="w-full p-3 rounded-xl bg-orange-600 text-white text-sm font-bold flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <span>Continue Your Academy</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

const ACKNOWLEDGMENTS = [
  "I understand commissions are paid for the first 24 months of a qualifying customer subscription.",
  "I understand affiliate marketing guidelines must be followed.",
  "I understand violations may result in suspension or termination of affiliate privileges.",
];

export default function AffiliateProgramOverview() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const hasPro = isProOrAbove(user);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);
  const [loading, setLoading] = useState(true);
  const [acct, setAcct] = useState<AffiliateAccount | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const allChecked = checked.every(Boolean);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest("/api/affiliate/account") as {
          account: AffiliateAccount | null;
        };
        const a = data?.account ?? null;
        setAcct(a);

        if (a) {
          const certMet =
            (a.requiredPhases === "phase_1_only" && !!a.phase1CompletedAt) ||
            (a.requiredPhases === "both_phases" && !!a.phase2CompletedAt);
          if (certMet && !a.activatedAt && !a.isActive) {
            apiRequest("/api/affiliate/activate-retry", { method: "POST" }).catch(() => {});
          }
        }
      } catch {
        setAcct(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDashboard() {
    if (dashboardLoading) return;
    setDashboardLoading(true);
    // Open window synchronously so browsers allow it as a user-initiated popup.
    const win = window.open("", "_blank", "noopener,noreferrer");
    try {
      const data: any = await apiRequest("/api/affiliate/dashboard-link");
      if (data?.url && win) {
        win.location.href = data.url;
      } else {
        win?.close();
      }
    } catch {
      win?.close();
      setLocation("/business-center/affiliate/dashboard");
    } finally {
      setDashboardLoading(false);
    }
  }

  function handleContinueAcademy() {
    if (acct?.affiliateTrack === "social_affiliate") {
      setLocation("/business-center/affiliate/social/certification");
    } else {
      setLocation("/business-center/affiliate/coaching/certification");
    }
  }

  async function handleStartAcademy() {
    try {
      await apiRequest("/api/affiliate/register-track", {
        method: "POST",
        body: JSON.stringify({ track: "business_affiliate" }),
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Non-blocking — proceed to certification even if already registered
    }
    setLocation("/business-center/affiliate/coaching/certification");
  }

  const isActive = acct?.isActive || !!acct?.activatedAt;
  const academyComplete = !!acct?.phase1CompletedAt;
  const hasTrack = !!acct?.affiliateTrack;
  const hasStartedJourney = hasTrack || academyComplete || isActive;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      {/* Header — mobile only; desktop uses DesktopLayout shell header */}
      {!isDesktop && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setLocation("/business-center/partners")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              Partner Programs
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white">Partner Program</h1>
              <p className="text-xs text-white/50">How it works — read before you apply</p>
            </div>
          </div>
        </div>
      )}

      <div
        className="px-4 max-w-2xl mx-auto space-y-4"
        style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* In-content back button — always visible on desktop where fixed header is trapped */}
        <button
          onClick={() => setLocation("/business-center/partners")}
          className="flex items-center gap-1.5 text-orange-400 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Partner Programs
        </button>

        {/* Status Panel — always visible */}
        <StatusPanel
          acct={acct}
          onDashboard={handleDashboard}
          dashboardLoading={dashboardLoading}
          onContinueAcademy={handleContinueAcademy}
        />

        {/* Hero */}
        <motion.div
          className="text-center py-4 space-y-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">My Perfect Meals</p>
          <h1 className="text-2xl font-black text-white leading-tight">Partner Program Overview</h1>
          <p className="text-sm text-gray-300 leading-relaxed max-w-sm mx-auto">
            Understand the economics before you activate. No surprises, no fine print buried at the end.
          </p>
        </motion.div>

        {/* Commission Structure */}
        <Section title="Commission Structure" delay={0.05}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Earn a percentage of qualifying subscription payments for every active customer you refer.
            </p>
          </div>
          <Row label="Commission rate" value="30% on qualifying payments" />
          <Row label="Commission period" value="First 24 months per customer" />
          <Row label="After 24 months" value="Commissions on that customer end" />
          <Row label="Customer cap" value="None — refer as many as you can" />
          <p className="text-xs text-gray-400 pt-1 leading-relaxed">
            The commission window starts from the date each referred customer subscribes, not from when you joined the program.
          </p>
        </Section>

        {/* Earnings Example */}
        <Section title="What You Can Earn — Example" delay={0.08}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              If you refer 10 customers each paying $29.99/month:
            </p>
          </div>
          <div className="rounded-xl bg-orange-500/20 border border-orange-500/30 p-4 space-y-1">
            <Row label="Your commission per customer" value="~$9/month" />
            <Row label="Monthly total (10 customers)" value="~$90/month" />
            <Row label="Duration" value="Up to 24 months while they stay active" />
            <Row label="Maximum from this group" value="~$2,160 over 24 months" />
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Commissions are paid on active, qualifying subscriptions only. Refunded or cancelled months do not qualify.
          </p>
        </Section>

        {/* Earnings Calculator */}
        <Section title="Estimated Earnings Calculator" delay={0.10}>
          <EarningsCalculator />
        </Section>

        {/* Why 24 Months */}
        <Section title="Why 24 Months?" delay={0.13}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Most affiliate and sales commission programs pay once, or for one year at most. Here is how ours compares.
            </p>
          </div>
          <div className="space-y-0">
            {[
              { label: "Typical one-time sales commission", value: "Single payment" },
              { label: "Most SaaS affiliate programs", value: "12 months or less" },
              { label: "My Perfect Meals", value: "24 months per customer" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 py-2 border-b border-white/10 last:border-0">
                <span className="text-xs text-gray-400">{item.label}</span>
                <span className={`text-xs font-semibold ${item.label.includes("My Perfect") ? "text-orange-400" : "text-gray-500"}`}>{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-300 leading-relaxed pt-1">
            The 24-month structure rewards you for bringing quality customers — and allows us to keep investing in the platform you are promoting.
          </p>
        </Section>

        {/* What Actually Works */}
        <Section title="What Actually Works" delay={0.16}>
          <div className="flex items-center gap-3 pb-1">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-300 leading-snug">{item}</span>
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
                  <span className="text-xs text-gray-300 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* For Coaches & Physicians */}
        <Section title="For Coaches & Physicians" delay={0.19}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Coaches and physicians earn in two distinct ways. Understanding both matters.
            </p>
          </div>
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-orange-400" />
                <p className="text-xs font-bold text-white">Direct Revenue</p>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed pl-6">
                Revenue from your coaching, training, consulting, or medical services. This is typically where professionals earn the most.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-orange-500/20 border border-orange-500/30 space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-400" />
                <p className="text-xs font-bold text-white">Affiliate Revenue</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed pl-6">
                Commissions earned when clients subscribe through your referral link. A supplement to your primary income, not a replacement.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Most coaches and physicians will earn significantly more from their core practice than from affiliate commissions. Both are valuable — just understand the difference.
          </p>
        </Section>

        {/* Compliance Policy */}
        <Section title="Compliance Requirements" delay={0.22}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              These are the same standards we hold ourselves to. Affiliates are an extension of this brand.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <p className="text-xs text-gray-300 leading-relaxed">
              Affiliates may not make claims regarding weight loss, disease treatment, disease prevention, guaranteed results, or any outcome not supported by the platform.
            </p>
            <p className="text-xs text-gray-300 leading-relaxed">
              Affiliates must follow My Perfect Meals marketing guidelines. Violations may result in suspension or termination of affiliate privileges.
            </p>
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] text-amber-600 font-bold">1</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-semibold text-amber-500">First violation:</span> Written warning and correction period.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-red-100 border border-red-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] text-red-600 font-bold">2</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-semibold text-red-500">Second violation:</span> Affiliate account terminated.
              </p>
            </div>
          </div>
        </Section>

        {/* Bottom CTA — acknowledgments for new users, quick action for returning */}
        {/* These are operational actions — require Pro subscription */}
        {!hasStartedJourney ? (
          <>
            {/* Acknowledgment gate — new users only */}
            <motion.div
              className="p-5 rounded-2xl bg-orange-500/20 border border-orange-500/30 space-y-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
            >
              <h2 className="text-sm font-bold text-white">Before You Continue</h2>
              <p className="text-xs text-gray-400 leading-relaxed">
                Confirm that you have read and understood the following. All three are required.
              </p>
              <div className="space-y-3">
                {ACKNOWLEDGMENTS.map((text, i) => (
                  <button
                    key={i}
                    onClick={() => toggle(i)}
                    className="w-full flex items-start gap-3 p-3.5 rounded-xl border text-left active:scale-[0.99] transition-all duration-150"
                    style={{
                      borderColor: checked[i] ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.1)",
                      backgroundColor: checked[i] ? "rgba(249,115,22,0.10)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-150"
                      style={{
                        borderColor: checked[i] ? "rgb(249,115,22)" : "rgba(255,255,255,0.2)",
                        backgroundColor: checked[i] ? "rgb(249,115,22)" : "transparent",
                      }}
                    >
                      {checked[i] && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs leading-relaxed transition-colors duration-150 ${checked[i] ? "text-white" : "text-gray-400"}`}>
                      {text}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="space-y-3 pt-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.30 }}
            >
              <button
                onClick={() => {
                  if (!allChecked) return;
                  if (!hasPro) { setUpgradeOpen(true); return; }
                  handleStartAcademy();
                }}
                disabled={!allChecked}
                className="w-full p-4 rounded-2xl font-bold text-sm flex items-center justify-between transition-all duration-200 active:scale-[0.98]"
                style={{
                  backgroundColor: allChecked ? "rgb(234,88,12)" : "rgba(255,255,255,0.05)",
                  color: allChecked ? "white" : "rgba(255,255,255,0.2)",
                  cursor: allChecked ? "pointer" : "default",
                }}
              >
                <span>Begin Platform Certification</span>
                <GraduationCap className="h-5 w-5" />
              </button>
              {!allChecked && (
                <p className="text-center text-xs text-gray-500 leading-relaxed">
                  Confirm all three items above to continue.
                </p>
              )}
            </motion.div>
          </>
        ) : (
          /* Returning users — quick action footer */
          <motion.div
            className="pt-2 space-y-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
          >
            {isActive || academyComplete ? (
              <button
                onClick={() => { if (!hasPro) { setUpgradeOpen(true); return; } handleDashboard(); }}
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-all"
              >
                <span>Open Partner Dashboard</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => { if (!hasPro) { setUpgradeOpen(true); return; } handleContinueAcademy(); }}
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-all"
              >
                <span>Continue Your Academy</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </motion.div>
        )}

      <FeatureUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        featureName="Partner Program Activation"
        description="Activate your affiliate account, earn commissions, and access the Partner Dashboard by upgrading to Pro."
      />
      </div>
    </motion.div>
  );
}
