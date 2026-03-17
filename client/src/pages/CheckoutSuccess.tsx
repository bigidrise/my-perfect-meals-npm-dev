import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

function getCurrentUser() {
  try {
    const raw =
      localStorage.getItem("mpm_current_user") || localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Checkout] Failed to parse user from localStorage", err);
    return null;
  }
}

interface PendingCoach {
  coachSlug: string;
  clientEmail: string;
  sessionId: string;
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
  const [isActivating, setIsActivating] = useState(true);
  const [isCoachingPurchase, setIsCoachingPurchase] = useState(false);
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

      const user = getCurrentUser();

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
        const response = await fetch(
          apiUrl(
            `/api/stripe/checkout-success?session_id=${encodeURIComponent(sessionId)}`,
          ),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": String(user.id),
            },
          },
        );

        if (!response.ok) {
          const text = await response.text();
          console.error("[Checkout] Activation failed:", text);
          throw new Error("Subscription activation failed");
        }

        const data = await response.json();
        console.log("[Checkout] Subscription activated:", data);

        const updatedUser = {
          ...user,
          entitlements: data.entitlements,
          planLookupKey: data.plan,
        };

        localStorage.setItem("mpm_current_user", JSON.stringify(updatedUser));
        localStorage.setItem("user", JSON.stringify(updatedUser));

        const pendingCoach = getPendingCoach();
        const isCoaching = data.plan === "mpm_guidance" || pendingCoach !== null;

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
        toast({
          title: "Activation Error",
          description:
            "There was an issue activating your subscription. Please contact support.",
          variant: "destructive",
        });
      } finally {
        setIsActivating(false);
      }
    };

    run();
  }, [setLocation, toast]);

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
                  href="mailto:support@myperfectmeals.com"
                  className="text-amber-400 hover:text-amber-300 underline"
                >
                  support@myperfectmeals.com
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
                href="mailto:support@myperfectmeals.com"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                support@myperfectmeals.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
