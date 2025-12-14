import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isActivating, setIsActivating] = useState(true);

  useEffect(() => {
    const activateSubscription = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      
      if (!sessionId) {
        console.error('[Checkout] No session_id in URL');
        setIsActivating(false);
        return;
      }

      try {
        // Get current user from localStorage
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          console.error('[Checkout] No user in localStorage');
          toast({
            title: "Error",
            description: "Please log in to activate your subscription",
            variant: "destructive",
          });
          setLocation("/auth");
          return;
        }

        const user = JSON.parse(userStr);
        
        // Call backend to activate subscription and get entitlements
        const response = await fetch(
          `/api/stripe/checkout-success?session_id=${sessionId}&user_id=${user.id}`
        );

        if (!response.ok) {
          throw new Error('Failed to activate subscription');
        }

        const data = await response.json();
        console.log('[Checkout] Subscription activated:', data);

        // Update user in localStorage with new entitlements
        const updatedUser = { ...user, entitlements: data.entitlements, planLookupKey: data.plan };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        toast({
          title: "Success!",
          description: "Your subscription is now active",
        });

        setIsActivating(false);
      } catch (error) {
        console.error('[Checkout] Activation error:', error);
        toast({
          title: "Activation Error",
          description: "There was an issue activating your subscription. Please contact support.",
          variant: "destructive",
        });
        setIsActivating(false);
      }
    };

    activateSubscription();
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

  return (
    <div className="min-h-screen py-12 bg-gradient-to-br from-neutral-900 via-black to-black text-white">
      <div className="container max-w-2xl mx-auto px-4">
        <Card className="bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/20 p-6">
                <CheckCircle className="w-16 h-16 text-green-400" />
              </div>
            </div>

            {/* Success Message */}
            <div className="space-y-3">
              <h1 className="text-3xl font-bold" data-testid="text-success-title">
                Welcome to My Perfect Meals!
              </h1>
              <p className="text-lg text-white/80" data-testid="text-success-message">
                Your subscription is now active. Get ready to transform your nutrition journey!
              </p>
            </div>

            {/* Features Preview */}
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

            {/* CTA Button */}
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

            {/* Support Link */}
            <p className="text-sm text-white/60 pt-4">
              Need help? Contact us at{" "}
              <a href="mailto:support@myperfectmeals.com" className="text-purple-400 hover:text-purple-300 underline">
                support@myperfectmeals.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
