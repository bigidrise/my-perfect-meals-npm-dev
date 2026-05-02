import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HandCoins, ShieldCheck, ChevronRight, Trophy, TrendingUp, Star } from "lucide-react";

const AFFILIATE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSew1J44zIE0skuvhGzEjc_AYcMZxrtla7Py0Jh2llUzpOZVWQ/viewform";

const TIERS = [
  {
    icon: <Star className="w-4 h-4 text-yellow-400" />,
    label: "Starter Affiliate",
    commission: "25%",
    range: "0–49 active subscribers",
    color: "border-yellow-400/30 bg-yellow-400/5",
  },
  {
    icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    label: "Growth Affiliate",
    commission: "30%",
    range: "50–99 active subscribers",
    color: "border-emerald-400/30 bg-emerald-400/5",
  },
  {
    icon: <Trophy className="w-4 h-4 text-purple-400" />,
    label: "Elite Affiliate",
    commission: "35%",
    range: "100+ active subscribers",
    color: "border-purple-400/30 bg-purple-400/5",
  },
];

export default function AffiliateOnPricing() {
  return (
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

        <ul className="list-disc pl-5 space-y-1 text-white/70 text-xs">
          <li>Recurring commission — paid for as long as your referral stays subscribed</li>
          <li>60-day tracking window, last-click attribution</li>
          <li>Monthly payouts · $25 minimum threshold</li>
          <li>Invite-only during alpha pilot</li>
        </ul>

        <div className="pt-1">
          <Button
            onClick={() => window.open(AFFILIATE_FORM_URL, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-2 bg-purple-700/70 hover:bg-purple-700 border border-purple-400/40"
            data-testid="button-affiliate-apply"
          >
            <ShieldCheck className="w-4 h-4" />
            Apply to Join
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>

        <p className="text-xs text-white/50">
          Invite-only during the controlled alpha pilot. Terms may be updated before public launch.
        </p>
      </CardContent>
    </Card>
  );
}
