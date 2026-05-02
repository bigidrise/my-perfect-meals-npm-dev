import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HandCoins, ShieldCheck, ChevronRight, Trophy, TrendingUp, Star } from "lucide-react";

const TIERS = [
  {
    icon: <Star className="w-4 h-4 text-yellow-400" />,
    label: "Starter Affiliate",
    commission: "25%",
    range: "0–49 active subscribers",
    color: "border-yellow-400/30 bg-yellow-400/5",
    badge: "bg-yellow-600/70",
  },
  {
    icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    label: "Growth Affiliate",
    commission: "30%",
    range: "50–99 active subscribers",
    color: "border-emerald-400/30 bg-emerald-400/5",
    badge: "bg-emerald-600/70",
  },
  {
    icon: <Trophy className="w-4 h-4 text-purple-400" />,
    label: "Elite Affiliate",
    commission: "35%",
    range: "100+ active subscribers",
    color: "border-purple-400/30 bg-purple-400/5",
    badge: "bg-purple-600/70",
  },
];

const AGREEMENT_TERMS = [
  {
    heading: "1. Commission Terms",
    body: "Affiliates start at 25% recurring commission (Starter tier: 0–49 active subscribers), scaling to 30% (Growth tier: 50–99) and up to 35% (Elite tier: 100+). Tier is based on your total active paying subscribers at the time of each payout.",
  },
  {
    heading: "2. Payment Terms",
    body: "Payouts are processed monthly. A minimum balance of $25 is required before a payout is issued. Commissions are earned for as long as your referrals remain subscribed.",
  },
  {
    heading: "3. Tracking",
    body: "A 60-day cookie window applies from the moment someone clicks your referral link. Attribution is last-click.",
  },
  {
    heading: "4. Conduct",
    body: "Affiliates may not engage in spam, misleading claims, or impersonation of the My Perfect Meals brand. Promotion must be honest and in line with applicable advertising guidelines.",
  },
  {
    heading: "5. Termination",
    body: "My Perfect Meals reserves the right to remove any affiliate from the program at any time. Confirmed fraud or abuse results in immediate removal and forfeiture of any unpaid commissions.",
  },
  {
    heading: "6. Modifications",
    body: "The commission structure and program terms may be updated in the future. Affiliates will be given reasonable notice of any material changes.",
  },
];

export default function AffiliateOnPricing() {
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleApply() {
    setShowAgreement(true);
  }

  function handleSubmit() {
    if (!agreed) return;
    setSubmitted(true);
    setShowAgreement(false);
  }

  return (
    <>
      <Card className="bg-black/60 text-white backdrop-blur-md border border-purple-400/40 ring-2 ring-purple-400/30 shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <HandCoins className="w-5 h-5 text-purple-300" />
              Founding Affiliate Program
            </CardTitle>
            <Badge className="bg-emerald-600/80">Alpha Pilot · Invite Only</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm md:text-base text-white/90">
          <p className="text-white/80 leading-relaxed">
            Share My Perfect Meals with your audience and earn recurring commission on every active subscription you bring into the platform. Affiliates grow from{" "}
            <span className="font-semibold text-white">25% up to 35%</span> as their subscriber base scales — with commissions paid for as long as your referrals stay subscribed.
          </p>

          {/* Tier Table */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {TIERS.map((tier) => (
              <div
                key={tier.label}
                className={`rounded-xl border p-3 flex flex-col gap-1 ${tier.color}`}
              >
                <div className="flex items-center gap-1.5">
                  {tier.icon}
                  <span className="text-xs font-semibold text-white/90">{tier.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{tier.commission}</div>
                <div className="text-xs text-white/60">{tier.range}</div>
              </div>
            ))}
          </div>

          {/* Key terms */}
          <ul className="list-disc pl-5 space-y-1 text-white/70 text-xs">
            <li>Recurring commission — paid for as long as your referral stays subscribed</li>
            <li>60-day tracking window, last-click attribution</li>
            <li>Monthly payouts · $25 minimum threshold</li>
            <li>Invite-only during alpha pilot</li>
          </ul>

          <div className="pt-1 flex flex-wrap gap-2">
            {submitted ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <ShieldCheck className="w-4 h-4" />
                Agreement accepted — we'll be in touch shortly.
              </div>
            ) : (
              <Button
                onClick={handleApply}
                className="inline-flex items-center gap-2 bg-purple-700/70 hover:bg-purple-700 border border-purple-400/40"
                data-testid="button-affiliate-apply"
              >
                <ShieldCheck className="w-4 h-4" />
                Apply to Join
                <ChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>

          <p className="text-xs text-white/50">
            Invite-only during the controlled alpha pilot. Terms may be updated before public launch.
          </p>
        </CardContent>
      </Card>

      {/* Agreement Modal */}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="bg-gray-950 border border-purple-400/30 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <HandCoins className="w-5 h-5 text-purple-300" />
              Affiliate Agreement
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm">
              Founding Affiliate Program · Alpha Pilot · Invite Only
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-white/80 mt-2">
            {AGREEMENT_TERMS.map((term) => (
              <div key={term.heading}>
                <p className="font-semibold text-white mb-1">{term.heading}</p>
                <p className="text-white/70 leading-relaxed">{term.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 bg-white/5 rounded-xl p-4 border border-white/10">
            <Checkbox
              id="affiliate-agree"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5 border-purple-400 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
            />
            <label htmlFor="affiliate-agree" className="text-sm text-white/90 leading-relaxed cursor-pointer">
              I have read and agree to the Affiliate Terms above. I understand that participation is invite-only during the alpha pilot and that terms may be updated with notice.
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!agreed}
              className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-affiliate-confirm"
            >
              Confirm &amp; Apply
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowAgreement(false)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
