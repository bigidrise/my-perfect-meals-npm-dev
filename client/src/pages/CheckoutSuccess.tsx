import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";

interface PendingCoach {
  coachSlug: string;
  clientEmail: string;
  sessionId: string;
  inviteToken?: string;
  ts: number;
}

function getPendingCoach(): PendingCoach | null {
  try {
    const raw = sessionStorage.getItem("mpm_pending_coach");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [isActivating, setIsActivating] = useState(true);
  const [isCoachingPurchase, setIsCoachingPurchase] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      if (!sessionId) {
        console.error("[Checkout] Missing session_id");
        toast({
          title: "Activation Error",
          description: "Invalid checkout session.",
          variant: "destructive",
        });
        setIsActivating(false);
        return;
      }

      if (!user?.id) {
        console.error("[Checkout] No user found for activation");
        toast({
          title: "Please log in",
          description: "Log in to activate your subscription.",
          variant: "destructive",
        });
        setLocation("/auth");
        return;
      }

      try {
        let data: any = null;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const response = await fetch(apiUrl("/api/stripe/reconcile-checkout"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            credentials: "include",
            body: JSON.stringify({ sessionId }),
          });

          if (response.ok) {
            data = await response.json();
            if (data.status === "active") break;
          } else if (response.status === 403) {
            throw new Error("Checkout session does not belong to this account");
          }

          if (attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          }
        }

        if (!data || data.status !== "active") {
          setActivationPending(true);
          return;
        }

        await refreshUser();
        console.log("[Checkout] Subscription verified:", data);

        const pendingCoach = getPendingCoach();
        const isCoaching = data.planLookupKey === "mpm_guidance" || pendingCoach !== null;
        const isOrg = data.planLookupKey === "clinical_business_monthly";

        if (isOrg) {
          toast({ title: "Organization activated!", description: "Let's get you set up." });
          setIsActivating(false);
          setLocation("/business-dashboard?checkout=success");
          return;
        }

        // Business / Organization signup return path — send them straight to Business Center
        const businessReturn = sessionStorage.getItem("mpm_business_return");
        if (businessReturn) {
          sessionStorage.removeItem("mpm_business_return");
          localStorage.removeItem("mpm_purchase_required");
          toast({
            title: "Pro access activated!",
            description: "Welcome to Business Center.",
          });
          setIsActivating(false);
          setLocation(businessReturn);
          return;
        }

        if (isCoaching) {
          setIsCoachingPurchase(true);

          if (pendingCoach) {
            const notifyKey = `coachNotified_${pendingCoach.sessionId}`;
            if (!sessionStorage.getItem(notifyKey)) {
              sessionStorage.setItem(notifyKey, "true");
              try {
                await fetch(apiUrl("/api/coaching/notify-coach"), {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders(),
                  },
                  body: JSON.stringify({
                    coachSlug: pendingCoach.coachSlug,
                    stripeSessionId: sessionId,
                    ...(pendingCoach.inviteToken ? { inviteToken: pendingCoach.inviteToken } : {}),
                  }),
                });
                console.log("[Checkout] Coach notification sent");
              } catch (err) {
                console.error("[Checkout] Coach notification failed:", err);
              }
              sessionStorage.removeItem("mpm_pending_coach");
            }
          }
        }

        toast({
          title: "Payment successful!",
          description: isCoaching
            ? "Your coach has been notified."
            : "Your subscription is now active.",
        });
      } catch (error) {
        console.error("[Checkout] Activation error:", error);
        setActivationPending(true);
      } finally {
        setIsActivating(false);
      }
    };

    run();
  }, [refreshUser, setLocation, toast, user?.id]);

  if (isActivating) {
    return (
      <div className="min-h-screen py-12 bg-gradient-to-br from-neutral-900 via-black to-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-400" />
          <p className="text-lg text-white/80">Activating your subscription...</p>
        </div>
      </div>
    );
  }

  if (activationPending) {
    return (
      <div className="min-h-screen py-12 bg-gradient-to-br from-neutral-900 via-black to-black text-white flex items-center justify-center">
        <Card className="mx-4 max-w-xl bg-black/30 backdrop-blur-lg border border-white/15 text-white">
          <CardContent className="pt-10 pb-10 text-center space-y-5">
            <Loader2 className="w-12 h-12 mx-auto text-amber-400" />
            <h1 className="text-2xl font-bold">Your payment is being verified</h1>
            <p className="text-white/75">
              Stripe confirmed your return, but your account update is still pending. Your payment will not be charged again.
            </p>
            <Button onClick={() => window.location.reload()}>
              Check again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCoachingPurchase) {
    return (
      <div className="min-h-screen py-12 bg-gradient-to-br from-neutral-900 via-black to-black text-white">
        <div className="container max-w-2xl mx-auto px-4">
          <Card className="bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl">
            <CardContent className="pt-12 pb-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-amber-500/20 p-6">
                  <CheckCircle className="w-16 h-16 text-amber-400" />
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-bold">You're all set.</h1>
                <p className="text-lg text-white/80">
                  Your coach has been notified and will contact you within 24 hours.
                </p>
                <p className="text-sm text-white/60">
                  Please check your messages and email for updates.
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6 mt-8 text-left space-y-3">
                <h3 className="font-semibold text-amber-300 text-center mb-4">What happens next</h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Your coach has received your assignment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Expect a message within 24 hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Your program begins once your coach activates it</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button
                  onClick={() => setLocation("/")}
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold px-8"
                >
                  Go to My Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>

              <p className="text-sm text-white/60 pt-4">
                Questions? Contact us at{" "}
                <a
                  href="mailto:support@myperfectmeals.ai"
                  className="text-amber-400 hover:text-amber-300 underline"
                >
                  support@myperfectmeals.ai
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 bg-gradient-to-br from-neutral-900 via-black to-black text-white">
      <div className="container max-w-2xl mx-auto px-4">
        <Card className="bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/20 p-6">
                <CheckCircle className="w-16 h-16 text-green-400" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold" data-testid="text-success-title">
                Welcome to My Perfect Meals!
              </h1>
              <p className="text-lg text-white/80" data-testid="text-success-message">
                Your subscription is now active. Get ready to transform your nutrition journey!
              </p>
            </div>

            <div className="bg-white/5 rounded-lg p-6 mt-8 space-y-3 text-left">
              <h3 className="font-semibold text-center mb-4">What's Next?</h3>
              <div className="space-y-2 text-sm text-white/90">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Complete your health profile for personalized meal plans</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Explore AI-powered meal creators and builders</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>Track your macros and biometrics effortlessly</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                onClick={() => setLocation("/")}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-8"
                data-testid="button-get-started"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            <p className="text-sm text-white/60 pt-4">
              Need help? Contact us at{" "}
              <a
                href="mailto:support@myperfectmeals.ai"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                support@myperfectmeals.ai
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
