import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HandCoins, ShieldCheck, ChevronRight, Lock } from "lucide-react";
import { useLocation } from "wouter";

const BENEFITS = [
  "30% recurring commissions for 24 months",
  "Dedicated affiliate link and referral tracking",
  "Personal affiliate dashboard",
  "Monthly payouts",
  "Marketing resources and affiliate support",
  "Early access to new features and programs",
];

export default function AffiliateOnPricing() {
  const [, setLocation] = useLocation();

  return (
    <Card className="bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <HandCoins className="w-5 h-5 text-orange-400" />
            Business Suite &amp; Affiliate Program
          </CardTitle>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap">
            Pro &amp; Above
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm md:text-base text-white/90">
        <div className="flex items-start gap-2.5 rounded-xl bg-orange-600/10 border border-orange-500/20 px-4 py-3">
          <Lock className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white/80 leading-relaxed">
            The My Perfect Meals Business Suite — including the standard Affiliate Program — is available with the{" "}
            <span className="font-semibold text-orange-300">Pro subscription and above.</span>
          </p>
        </div>

        <p className="text-white/70 leading-relaxed text-sm">
          Share My Perfect Meals with your audience and earn recurring commissions on paid subscriptions you refer to the platform.
        </p>

        <div className="rounded-xl bg-orange-600/10 border border-orange-500/20 px-4 py-3">
          <p className="text-lg font-bold text-white">30% Commission</p>
          <p className="text-sm text-white/70 mt-0.5">
            Earn 30% recurring commissions on subscription payments for up to 24 months.
          </p>
        </div>

        <ul className="space-y-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-white/75 text-sm">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-1">
            Separate Partnership Opportunities
          </p>
          <p className="text-xs text-white/60 leading-relaxed">
            Founding Partner and White Label programs are separate partnership opportunities with their own eligibility requirements.
            Top-performing affiliates, healthcare professionals, and industry partners may qualify for customized arrangements.
          </p>
        </div>

        <div className="pt-1">
          <Button
            onClick={() => setLocation("/pricing#pro")}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-affiliate-upgrade"
          >
            <ShieldCheck className="w-4 h-4" />
            Upgrade to Pro to Access
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>

        <p className="text-xs text-white/50">
          Program terms may evolve as My Perfect Meals continues to grow.
        </p>
      </CardContent>
    </Card>
  );
}
