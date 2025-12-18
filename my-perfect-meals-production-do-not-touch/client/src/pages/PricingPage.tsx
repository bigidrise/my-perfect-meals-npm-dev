import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, ArrowLeft, CreditCard } from "lucide-react";
import AffiliateOnPricing from "@/components/AffiliateOnPricing";
import { PLAN_SKUS, getPlansByGroup } from "@/data/planSkus";
import { startCheckout, IOS_BLOCK_ERROR } from "@/lib/checkout";
import { isIosNativeShell, IOS_PAYMENT_MESSAGE } from "@/lib/platform";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const consumerPlans = getPlansByGroup("consumer");
  const familyPlans = getPlansByGroup("family");

  const handleBackNavigation = () => {
    if (user) {
      setLocation("/dashboard");
    } else {
      setLocation("/welcome");
    }
  };

  const handleSelectPlan = async (sku: string) => {
    if (isIosNativeShell()) {
      toast({ ...IOS_PAYMENT_MESSAGE, variant: "default" });
      return;
    }

    try {
      await startCheckout(sku as any, { context: "pricing_page" });
    } catch (error) {
      if ((error as any)?.code === IOS_BLOCK_ERROR) {
        toast({ ...IOS_PAYMENT_MESSAGE, variant: "default" });
        return;
      }
      toast({
        title: "Checkout Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getButtonText = (sku: string): string => {
    const currentPlan = user?.planLookupKey;

    if (currentPlan === sku) {
      return "Current Plan";
    }

    if (!currentPlan) {
      return "Select Plan";
    }

    // Define tier hierarchy for consumer plans
    const consumerTiers: Record<string, number> = {
      mpm_basic_monthly: 1,
      mpm_premium_monthly: 2,
      mpm_premium_beta_monthly: 2, // Same tier as upgrade
      mpm_ultimate_monthly: 3,
      mpm_procare_monthly: 4,
    };

    // Define tier hierarchy for family plans
    const familyTiers: Record<string, number> = {
      mpm_family_base_monthly: 1,
      mpm_family_all_upgrade_monthly: 2,
      mpm_family_all_ultimate_monthly: 3,
    };

    const currentTier = consumerTiers[currentPlan] || familyTiers[currentPlan];
    const targetTier = consumerTiers[sku] || familyTiers[sku];

    // Different plan types (consumer vs family) can't be compared
    const isConsumerPlan = (plan: string) => plan in consumerTiers;
    const isFamilyPlan = (plan: string) => plan in familyTiers;

    if (isConsumerPlan(currentPlan) && isFamilyPlan(sku)) {
      return "Switch to Family";
    }

    if (isFamilyPlan(currentPlan) && isConsumerPlan(sku)) {
      return "Switch to Individual";
    }

    // Same plan type comparison
    if (currentTier !== undefined && targetTier !== undefined) {
      if (targetTier > currentTier) {
        return "Upgrade";
      } else if (targetTier < currentTier) {
        return "Downgrade";
      }
    }

    return "Select Plan";
  };

  const legacyFeatures = {
    basic: [
      "Weekly Meal Builder",
      "GLP-1 Hub and Meal Builder",
      "Diabetic Hub and Meal Builder",
      "Anti-Inflammatory Meal Bulider",
      "Daily Macro Calculator",
      "Supplement Hub",
      "Biometrics",
      "Daily Health Journal",
    ],
    premium: [
      "Everything in Basic",
      "Craving Creator",
      "Find Meals Near Me / Restaurant Guide",
      "Fridge Rescue",
      "Healthy Kids Meals Hub",
      "Spirit & Lifestyle Hub",
    ],
    ultimate: [
      "Everything in Premium",
      "Care Team / Pro Access",
      "Beach Body / Hard Body Meal Builder",
      "Lab Values (coming soon)",
      "Medical Diet Hub (coming soon",
      "Food Delivery (coming soon)",
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-safe-nav"
    >
      {/* Fixed Black Glass Navigation Banner */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/10 backdrop-blur-none border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={handleBackNavigation}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            
            Subscription
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-6xl mx-auto px-4 text-white space-y-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
                {/* Consumer Plans Grid */}
                <div className="mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {consumerPlans.map((plan) => {
                      const features =
                        plan.sku === "mpm_basic_monthly"
                          ? legacyFeatures.basic
                          : plan.sku === "mpm_premium_monthly"
                            ? legacyFeatures.premium
                            : legacyFeatures.ultimate;

                      return (
                        <Card
                          key={plan.sku}
                          className={`relative h-full bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl ${
                            plan.badge ? "ring-1 ring-purple-400/30" : ""
                          }`}
                          data-testid={`plan-card-${plan.sku}`}
                        >
                          {plan.badge && (
                            <Badge className="absolute top-3 right-3 bg-purple-600/80 text-white backdrop-blur-sm border border-white/10">
                              {plan.badge}
                            </Badge>
                          )}

                          <CardHeader className="pb-4">
                            <div className="space-y-2">
                              <h3 className="text-xl font-bold">
                                {plan.label}
                              </h3>
                              <p className="text-sm text-white/80">
                                {plan.blurb}
                              </p>
                              <p className="text-lg font-semibold">
                                ${plan.price.toFixed(2)} / month
                              </p>
                            </div>
                          </CardHeader>

                          <Separator className="bg-white/10" />

                          <CardContent className="pt-6">
                            <div className="space-y-3">
                              {features.map((label, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2"
                                >
                                  <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm text-white">
                                    {label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </CardContent>

                          <Separator className="bg-white/10" />

                          <div className="p-6">
                            <Button
                              className={`w-full ${
                                plan.badge
                                  ? "bg-white/10 hover:bg-white/15 border border-white/20 text-white"
                                  : "bg-white/5 hover:bg-white/10 border border-white/20 text-white"
                              }`}
                              size="lg"
                              onClick={() => handleSelectPlan(plan.sku)}
                              disabled={user?.planLookupKey === plan.sku}
                              data-testid={`button-select-${plan.sku}`}
                            >
                              {getButtonText(plan.sku)}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Family Plans Section */}
                <div className="mb-12">
                  <h2 className="text-xl font-bold mb-6 text-center">
                    Family Plans
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {familyPlans.map((plan) => (
                      <Card
                        key={plan.sku}
                        className="relative h-full bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl"
                        data-testid={`plan-card-${plan.sku}`}
                      >
                        {plan.badge && (
                          <Badge className="absolute top-3 right-3 bg-blue-600/80 text-white backdrop-blur-sm border border-white/10">
                            {plan.badge}
                          </Badge>
                        )}

                        <CardHeader className="pb-4">
                          <div className="space-y-2">
                            <h3 className="text-xl font-bold">{plan.label}</h3>
                            <p className="text-sm text-white/80">
                              {plan.blurb}
                            </p>
                            <p className="text-lg font-semibold">
                              ${plan.price.toFixed(2)} / month
                            </p>
                            {plan.seats && (
                              <p className="text-xs text-white/60">
                                Includes up to {plan.seats} profiles
                              </p>
                            )}
                          </div>
                        </CardHeader>

                        <Separator className="bg-white/10" />

                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            {plan.features?.map((label, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-white">
                                  {label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>

                        <Separator className="bg-white/10" />

                        <div className="p-6">
                          <Button
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/20 text-white"
                            size="lg"
                            onClick={() => handleSelectPlan(plan.sku)}
                            disabled={user?.planLookupKey === plan.sku}
                            data-testid={`button-select-${plan.sku}`}
                          >
                            {getButtonText(plan.sku)}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Affiliate Panel */}
                <div className="mb-12">
                  <AffiliateOnPricing />
                </div>

                {/* Apple App Store Compliance Section */}
                <div className="mb-12 space-y-6">
                  {/* Subscription Terms - Apple Required */}
                  <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-4 text-center space-y-3">
                    <p className="text-white/90 text-sm font-medium">
                      7-Day Free Trial, then $9.99/month (Basic), $19.99/month (Premium), or $29.99/month (Ultimate)
                    </p>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Payment will be charged to your account at confirmation of purchase. 
                      Subscription automatically renews unless canceled at least 24 hours before the end of the current period. 
                      Your account will be charged for renewal within 24 hours prior to the end of the current period. 
                      You can manage and cancel your subscription in your account settings.
                    </p>
                    <div className="flex justify-center gap-4 text-xs">
                      <button 
                        onClick={() => setLocation("/terms-of-service")}
                        className="text-lime-400 underline hover:text-lime-300"
                      >
                        Terms of Service
                      </button>
                      <button 
                        onClick={() => setLocation("/privacy-policy")}
                        className="text-lime-400 underline hover:text-lime-300"
                      >
                        Privacy Policy
                      </button>
                    </div>
                  </div>

                  {/* Restore Purchases */}
                  <div className="text-center">
                    <button
                      onClick={async () => {
                        if (!user?.email) {
                          toast({
                            title: "Sign In Required",
                            description: "Please sign in to restore your purchases.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        toast({
                          title: "Checking Subscription...",
                          description: "Looking up your account...",
                        });
                        
                        try {
                          const response = await fetch(apiUrl("/api/stripe/subscription-status"), {
                            headers: {
                              "x-auth-token": localStorage.getItem("authToken") || "",
                            },
                          });
                          
                          if (response.ok) {
                            const data = await response.json();
                            if (data.hasActiveSubscription) {
                              toast({
                                title: "Subscription Found!",
                                description: `Your ${data.planName || "subscription"} is active. Refreshing...`,
                              });
                              window.location.reload();
                            } else {
                              toast({
                                title: "No Active Subscription",
                                description: "No active subscription found for your account.",
                              });
                            }
                          } else {
                            toast({
                              title: "Subscription Restored",
                              description: "If you have an active subscription, it has been synced to your account.",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Restore Complete",
                            description: "Your subscription status has been refreshed.",
                          });
                        }
                      }}
                      className="text-white/60 text-sm underline hover:text-white/80 transition-colors"
                    >
                      Restore Purchases
                    </button>
                  </div>

                  {/* Support Contact */}
                  <p className="text-white/50 text-xs text-center">
                    Need help? Contact us at{" "}
                    <a 
                      href="mailto:support@myperfectmeals.com" 
                      className="text-lime-400 underline hover:text-lime-300"
                    >
                      support@myperfectmeals.com
                    </a>
                  </p>
                </div>
      </div>
    </motion.div>
  );
}
