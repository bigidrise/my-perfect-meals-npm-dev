// 🔒 LOCKED: FUTURE FEATURE
// This page is intentionally not imported in the router yet.
// It is reserved for launch or future upgrades.
// DO NOT delete, refactor, or auto-route this file without explicit user approval.

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Link as LinkIcon, ArrowLeft, Loader2 } from "lucide-react";

export default function AffiliatesPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Founding Affiliate Program | My Perfect Meals";
  }, []);

  async function handleVerifyEmail() {
    if (!email) return;

    setIsVerifying(true);
    try {
      const response = await fetch("/api/affiliates/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();
      setIsAllowed(data.eligible);
    } catch (error) {
      console.error("Failed to verify email:", error);
      setIsAllowed(false);
    } finally {
      setIsVerifying(false);
    }
  }

  function handleJoin() {
    if (!isAllowed) return;
    // Rewardful hosts the affiliate portal; open in a new tab.
    // TODO: Replace with your actual Rewardful affiliate portal URL
    window.open("https://your-subdomain.getrewardful.com", "_blank", "noopener");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-black to-indigo-950 p-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        className="fixed top-4 left-4 z-50 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/10 text-white p-3"
        onClick={() => setLocation("/pricing")}
        data-testid="button-back-to-pricing"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="max-w-xl mx-auto pt-8 md:pt-16">
        <Card className="bg-black/60 border-white/10 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <ShieldCheck className="w-5 h-5" />
              Founding Affiliate (Invite-Only)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-white/90">
            <p className="text-sm">
              Do you have friends and family who could benefit from My Perfect Meals? Share the app and earn{" "}
              <span className="font-semibold">25% recurring commission</span> on every referral for as long as they stay subscribed.
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Beta pricing: $9.99/mo (earn 25%)</li>
              <li>Launch pricing: $19.99/mo with 60-day trial of $29.99 features (earn 25%)</li>
              <li>Cookie: 60 days</li>
              <li>Payouts: Monthly (min. $25 balance)</li>
              <li>Limited to 5 affiliates during pilot</li>
            </ul>

            <Separator className="my-4 bg-white/10" />

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Your Email (for verification)</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md bg-white/5 border border-white/10 p-2 text-sm outline-none focus:border-white/30 text-white placeholder:text-white/40"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsAllowed(null); // Reset verification status when email changes
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerifyEmail();
                  }}
                  type="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  data-testid="input-affiliate-email"
                />
                <Button
                  onClick={handleVerifyEmail}
                  disabled={!email || isVerifying}
                  className="flex items-center gap-2"
                  data-testid="button-verify-email"
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {isAllowed === true ? (
                  <Badge variant="default" className="bg-emerald-600/80" data-testid="badge-eligible">✓ Eligible</Badge>
                ) : isAllowed === false ? (
                  <Badge variant="secondary" className="bg-red-600/70 text-white" data-testid="badge-not-eligible">Not on invite list</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-white/10 text-white/70" data-testid="badge-enter-email">Enter email to verify</Badge>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleJoin}
                disabled={!isAllowed}
                className="w-full flex items-center gap-2"
                data-testid="button-affiliate-portal"
              >
                <LinkIcon className="w-4 h-4" />
                Go to Affiliate Portal
              </Button>
            </div>

            <Separator className="my-4 bg-white/10" />

            <div className="space-y-3 text-xs text-white/70">
              <h3 className="font-semibold text-white/90 uppercase tracking-wide">Affiliate Pilot Terms</h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Commission: <strong>25% recurring</strong> on every referral - Beta: $9.99/mo, Launch: $19.99/mo (60-day trial includes $29.99 features).</li>
                <li>Payouts: Monthly via PayPal/Stripe; <strong>$25 minimum</strong>.</li>
                <li>Tracking: <strong>60-day cookie</strong>; no commission on refunds/cancellations.</li>
                <li>Promotion rules: No spam, bots, coupon hijacking, or misleading claims; use approved assets.</li>
                <li>Scope: This <strong>alpha affiliate pilot</strong> may change before public launch.</li>
                <li>Termination: We may remove affiliates for abuse or policy violations.</li>
              </ol>
            </div>

            <p className="text-xs text-white/60 pt-4">
              This is a limited alpha affiliate pilot. Terms may change before public launch.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
