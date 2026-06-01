import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HandCoins, ShieldCheck, ChevronRight } from "lucide-react";

const AFFILIATE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSew1J44zIE0skuvhGzEjc_AYcMZxrtla7Py0Jh2llUzpOZVWQ/viewform";

const BENEFITS = [
  "30% recurring commissions for 24 months",
  "Dedicated affiliate link and referral tracking",
  "Personal affiliate dashboard",
  "Monthly payouts",
  "Marketing resources and affiliate support",
  "Early access to new features and programs",
];

export default function AffiliateOnPricing() {
  return (
    <Card className="bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <HandCoins className="w-5 h-5 text-orange-400" />
          Founding Affiliate Program
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm md:text-base text-white/90">
        <p className="text-white/80 leading-relaxed">
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
            Built for Long-Term Partnerships
          </p>
          <p className="text-xs text-white/60 leading-relaxed">
            Top-performing affiliates, strategic partners, and industry leaders may be eligible for customized partnership opportunities and enhanced commission structures.
          </p>
        </div>

        <div className="pt-1">
          <Button
            onClick={() => window.open(AFFILIATE_FORM_URL, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-affiliate-apply"
          >
            <ShieldCheck className="w-4 h-4" />
            Apply to Join
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>

        <p className="text-xs text-white/50">
          Invite-only during the controlled alpha pilot. Program terms may evolve as My Perfect Meals continues to grow.
        </p>
      </CardContent>
    </Card>
  );
}
