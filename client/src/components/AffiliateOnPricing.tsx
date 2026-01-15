import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { HandCoins, ShieldCheck } from "lucide-react";

export default function AffiliateOnPricing() {
  const [, setLocation] = useLocation();

  return (
      <Card className="bg-black/60 text-white backdrop-blur-md border border-purple-400/40 ring-2 ring-purple-400/30 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <HandCoins className="w-5 h-5" />
            Founding Affiliate (Invite-Only)
          </CardTitle>
          <Badge className="bg-emerald-600/80">Alpha Pilot</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm md:text-base text-white/90">
        <p>
          Do you have friends and family who could benefit from this app? Share My Perfect Meals and earn
          <span className="font-semibold"> 25% recurring commission</span> on every referral.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-white/80 text-sm">
          <li>Beta: $9.99/mo</li>
          <li>Launch: $19.99/mo with 60-day trial of $29.99 features (25% commission)</li>
          <li>Monthly payouts ($25 min)</li>
          <li>Limited to 5 affiliates during pilot</li>
        </ul>
        <div className="pt-1 flex flex-wrap gap-2">
          <Button
            onClick={() => setLocation("/affiliates")}
            className="inline-flex items-center gap-2"
            disabled={true}
            data-testid="button-learn-more-affiliate"
          >
            <ShieldCheck className="w-4 h-4" />
            Learn More
          </Button>
          <Button
            variant="secondary"
            onClick={() => setLocation("/contact")}
            className="bg-white/10 border border-white/20 hover:bg-white/15"
            disabled={true}
            data-testid="button-join-affiliate-waitlist"
          >
            Join Waitlist
          </Button>
        </div>
        <p className="text-xs text-white/60">
          Terms may change before public launch. Abuse = removal. We play fair.
        </p>
      </CardContent>
    </Card>
  );
}
