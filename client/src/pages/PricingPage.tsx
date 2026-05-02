import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  ArrowLeft,
  CreditCard,
  Apple,
  RefreshCw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import AffiliateOnPricing from "@/components/AffiliateOnPricing";
import { PLAN_SKUS, getPlansByGroup } from "@/data/planSkus";
import {
  getDisplayFeaturesForTier,
  IOS_DISPLAY_FEATURES,
} from "@shared/planFeatures";
import { startCheckout, IOS_BLOCK_ERROR } from "@/lib/checkout";
import {
  isIosNativeShell,
  IOS_PAYMENT_MESSAGE,
  openAppleSubscriptions,
} from "@/lib/platform";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { restorePurchases, purchaseProduct } from "@/lib/storekit";
import { IOS_PRODUCTS, type IosProduct } from "@/lib/iosProducts";
import type { LookupKey } from "@/data/planSkus";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const consumerPlans = getPlansByGroup("consumer");
  const familyPlans = getPlansByGroup("family");
  const proPlans = getPlansByGroup("pro");

  const [purchasingProduct, setPurchasingProduct] = useState<string | null>(
    null,
  );
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  const [procareRole, setProcareRole] = useState<"trainer" | "physician" | null>(
    () => (localStorage.getItem("procare_role") as "trainer" | "physician" | null) || null
  );

  const procareRolePlans = procareRole === "trainer"
    ? proPlans.filter((p) => p.sku.startsWith("mpm_trainer_"))
    : procareRole === "physician"
      ? proPlans.filter((p) => p.sku.startsWith("mpm_physician_"))
      : [];

  async function handleIosPurchase(product: IosProduct) {
    setPurchasingProduct(product.productId);
    try {
      const result = await purchaseProduct(product.internalSku);
      if (result.success) {
        toast({
          title: "Purchase Successful",
          description:
            "Your subscription is now active. Enjoy premium features!",
        });
        setLocation("/dashboard");
      } else if (result.error !== "Purchase cancelled") {
        toast({
          title: "Purchase Failed",
          description: result.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Purchase Error",
        description: e.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasingProduct(null);
    }
  }

  async function handleRestorePurchases() {
    setRestoringPurchases(true);
    try {
      const results = await restorePurchases();
      const successful = results.filter((r) => r.success);
      if (successful.length > 0) {
        toast({
          title: "Purchases Restored",
          description: "Your subscription has been restored successfully.",
        });
        setLocation("/dashboard");
      } else {
        toast({
          title: "No Purchases Found",
          description: "No previous purchases were found to restore.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Restore Failed",
        description: e.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRestoringPurchases(false);
    }
  }

  if (isIosNativeShell()) {
    const iosSubscriptionPlans = IOS_PRODUCTS.map((p) => p.internalSku);

    const planKey = user?.planLookupKey || "";
    const hasIosSubscription =
      !!planKey && iosSubscriptionPlans.includes(planKey);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-safe-nav"
      >
        <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/10 backdrop-blur-none border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              onClick={() =>
                user ? setLocation("/dashboard") : setLocation("/welcome")
              }
              className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <h1 className="text-lg font-bold text-white">Subscription</h1>
          </div>
        </div>
        </MobileHeaderGuard>

        <div
          className="max-w-md mx-auto px-6 text-white"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
        >
          {hasIosSubscription && (
            <div className="bg-lime-500/20 border border-lime-500/30 rounded-xl p-4 mb-6 text-center">
              <p className="text-lime-400 font-medium text-sm">
                Active Subscription
              </p>
              <p className="text-white text-lg font-bold mt-1">
                {planKey
                  .replace(/_/g, " ")
                  .replace("mpm ", "")
                  .replace(" monthly", "")}
              </p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <h2 className="text-xl font-bold text-center mb-4">
              Choose Your Plan
            </h2>

            <div
              className={`bg-black/40 backdrop-blur-lg border rounded-xl p-5 ${
                !planKey || planKey === "mpm_free"
                  ? "border-lime-400/50 ring-1 ring-lime-400/30"
                  : "border-white/15"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-white font-bold text-lg">Free</h3>
                  <p className="text-white/60 text-sm">$0/mo</p>
                </div>
                {(!planKey || planKey === "mpm_free") && (
                  <Badge className="bg-lime-500/80 text-white text-xs">
                    Current
                  </Badge>
                )}
              </div>
              <ul className="text-white/70 text-xs space-y-1.5 mb-4">
                {getDisplayFeaturesForTier("free").map((label, fi) => (
                  <li key={fi} className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-lime-400" />
                    {label}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setLocation("/dashboard")}
                disabled={!planKey || planKey === "mpm_free"}
                className={`w-full ${
                  !planKey || planKey === "mpm_free"
                    ? "bg-lime-500/20 text-lime-300 border border-lime-500/30 cursor-not-allowed"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                }`}
              >
                {!planKey || planKey === "mpm_free"
                  ? "Current Plan"
                  : "Start Free"}
              </Button>
            </div>

            {IOS_PRODUCTS.map((product) => {
              const displayPrice = `$${product.price.toFixed(2)}/mo`;
              const isPurchasing = purchasingProduct === product.productId;
              const isPremium = product.internalSku === "mpm_premium_monthly";
              const isCurrentPlan = planKey === product.internalSku;

              return (
                <div
                  key={product.productId}
                  className={`bg-black/40 backdrop-blur-lg border rounded-xl p-5 ${
                    isPremium
                      ? "border-orange-400/50 ring-1 ring-orange-400/30"
                      : "border-white/15"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        {product.label}
                      </h3>
                      <p className="text-white/60 text-sm">{displayPrice}</p>
                    </div>
                    {isCurrentPlan ? (
                      <Badge className="bg-lime-500/80 text-white text-xs">
                        Current
                      </Badge>
                    ) : isPremium ? (
                      <Badge className="bg-orange-500/80 text-white text-xs">
                        Most Popular
                      </Badge>
                    ) : null}
                  </div>

                  <ul className="text-white/70 text-xs space-y-1.5 mb-4">
                    {(
                      IOS_DISPLAY_FEATURES[
                        product.internalSku === "mpm_basic_monthly"
                          ? "basic"
                          : product.internalSku === "mpm_premium_monthly"
                            ? "premium"
                            : "ultimate"
                      ] || []
                    ).map((label, fi) => (
                      <li key={fi} className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-lime-400" />
                        {label}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleIosPurchase(product)}
                    disabled={isCurrentPlan || isPurchasing}
                    className={`w-full ${
                      isCurrentPlan
                        ? "bg-lime-500/20 text-lime-300 border border-lime-500/30 cursor-not-allowed"
                        : isPremium
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                    }`}
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : (
                      <>
                        <Apple className="w-4 h-4 mr-2" />
                        Subscribe with Apple
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-white/15 rounded-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-white/10 rounded-full flex items-center justify-center">
              <Apple className="w-7 h-7 text-white" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">
                Manage Your Subscription
              </h2>
              <p className="text-white/70 text-sm leading-relaxed">
                Subscriptions are managed securely through Apple. Tap below to
                view, upgrade, or cancel your subscription.
              </p>
            </div>

            <Button
              onClick={async () => {
                try {
                  await openAppleSubscriptions();
                } catch (e) {
                  console.error(
                    "[Pricing] Failed to open manage subscriptions:",
                    e,
                  );
                  toast({
                    title: "Unable to open subscriptions",
                    description:
                      "Please go to Settings > Apple ID > Subscriptions to manage your plan.",
                    variant: "destructive",
                  });
                }
              }}
              className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Apple Subscriptions
            </Button>

            <Button
              onClick={handleRestorePurchases}
              disabled={restoringPurchases}
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/5"
            >
              {restoringPurchases ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Restore Purchases
                </>
              )}
            </Button>
          </div>

          <div className="mt-8 mb-6">
            <h2 className="text-lg font-bold text-center mb-4">
              More Ways to Use My Perfect Meals
            </h2>
            <p className="text-white/60 text-xs text-center mb-4">
              Need more structure than a subscription plan? My Perfect Meals also offers coaching and guided systems for individuals and families.
            </p>
            <div className="space-y-3">
              <div className="bg-black/40 backdrop-blur-lg border border-white/15 rounded-xl p-4">
                <h3 className="text-white font-bold text-base mb-1">ProCare Coaching</h3>
                <p className="text-white/60 text-xs mb-3">
                  Some people don't struggle with nutrition knowledge. They struggle with decisions in the moment. ProCare connects you with a real coach inside the My Perfect Meals system so you're not left guessing when real life happens.
                </p>
                <ul className="text-white/50 text-xs space-y-1 mb-3">
                  <li>• Direct messaging with your coach</li>
                  <li>• Guidance before food decisions, not after mistakes</li>
                  <li>• Adjust meals and macros when life changes</li>
                  <li>• Support when stress, travel, or cravings hit</li>
                </ul>
                <Button
                  onClick={() => setLocation("/procare-info")}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm"
                >
                  Learn More
                </Button>
              </div>
              <div className="bg-black/40 backdrop-blur-lg border border-white/15 rounded-xl p-4">
                <h3 className="text-white font-bold text-base mb-1">Family Plan</h3>
                <p className="text-white/60 text-xs mb-3">
                  Trying to eat healthy while everyone in the house eats differently creates chaos. The My Perfect Meals Family Plan gives every person their own personalized nutrition experience while keeping the household organized in one system.
                </p>
                <ul className="text-white/50 text-xs space-y-1 mb-3">
                  <li>• Individual profiles for every family member</li>
                  <li>• Personalized nutrition guidance for each person</li>
                  <li>• Kids, parents, and partners on the same system</li>
                  <li>• One organized plan for the whole household</li>
                </ul>
                <Button
                  onClick={() => setLocation("/family-info")}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm"
                >
                  Learn More
                </Button>
              </div>
              <div className="bg-black/40 backdrop-blur-lg border border-amber-500/30 rounded-xl p-4 ring-1 ring-amber-500/20">
                <h3 className="text-amber-300 font-bold text-base mb-1">MPM Personal Guidance</h3>
                <p className="text-white/60 text-xs mb-3">
                  Some people don't just want guidance. They want someone experienced helping them structure the entire system. MPM Personal Guidance connects you directly with the founder of My Perfect Meals for structured, in-app coaching and ongoing adjustments.
                </p>
                <ul className="text-white/50 text-xs space-y-1 mb-3">
                  <li>• Direct async messaging with the founder</li>
                  <li>• Personalized meal board setup and calibration</li>
                  <li>• Long-term nutrition structure and accountability</li>
                  <li>• Coaching built directly into the My Perfect Meals system</li>
                </ul>
                <Button
                  onClick={() => setLocation("/personal-guidance-info")}
                  className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-sm"
                >
                  See How Personal Guidance Works
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-6 space-y-3 text-center">
            <Button
              onClick={() =>
                user ? setLocation("/dashboard") : setLocation("/welcome")
              }
              variant="ghost"
              className="text-white/60 hover:text-white"
            >
              Continue to App
            </Button>

            <p className="text-white/40 text-xs">
              Need help?{" "}
              <a
                href="mailto:support@myperfectmeals.com"
                className="text-lime-400 underline"
              >
                support@myperfectmeals.com
              </a>
            </p>
            <p className="text-white/40 text-xs">
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 underline hover:text-white/70"
              >
                Terms of Use (EULA)
              </a>
              {" · "}
              <button
                onClick={() => window.location.href = "/privacy-policy"}
                className="text-white/50 underline hover:text-white/70"
              >
                Privacy Policy
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const handleBackNavigation = () => {
    if (user) {
      setLocation("/dashboard");
    } else {
      setLocation("/welcome");
    }
  };

  const handleSelectPlan = async (sku: string) => {
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
      mpm_family_base: 1,
      mpm_family_base_monthly: 1,
      mpm_family_premium: 2,
      mpm_family_all_upgrade_monthly: 2,
      mpm_family_all_premium_monthly: 2,
      mpm_family_ultimate: 3,
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

  const freeFeatures = getDisplayFeaturesForTier("free");
  const basicFeatures = getDisplayFeaturesForTier("basic");
  const premiumFeatures = getDisplayFeaturesForTier("premium");
  const ultimateFeatures = getDisplayFeaturesForTier("ultimate");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-safe-nav"
    >
      {/* Fixed Black Glass Navigation Banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/10 backdrop-blur-none border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
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
        {/* ProCare Professional Plans — shown when user arrived from ProCare onboarding */}
        {procareRole && procareRolePlans.length > 0 && (
          <div className="mb-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-full px-4 py-2 mb-4">
                <span className="text-blue-300 text-sm font-semibold tracking-wide uppercase">
                  ProCare Professional
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">Choose Your Provider Plan</h2>
              <p className="text-white/60 text-sm mt-2 max-w-lg mx-auto">
                {procareRole === "trainer"
                  ? "Select the plan that matches the number of clients you manage. You can upgrade any time."
                  : "Select the plan that fits your practice size. Includes full patient nutrition management tools."}
              </p>
            </div>

            <div className={`grid gap-5 ${procareRolePlans.length <= 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}>
              {procareRolePlans.map((plan) => {
                const isCurrentPlan = user?.planLookupKey === plan.sku;
                const isMostPopular = !!plan.badge;
                return (
                  <Card
                    key={plan.sku}
                    className={`relative h-full backdrop-blur-lg text-white shadow-xl flex flex-col ${
                      isMostPopular
                        ? "bg-blue-900/40 border-2 border-blue-400/60 ring-2 ring-blue-400/30"
                        : "bg-black/30 border border-white/15"
                    }`}
                  >
                    {isMostPopular && (
                      <Badge className="absolute top-3 right-3 bg-blue-500/80 text-white backdrop-blur-sm border border-white/10">
                        {plan.badge}
                      </Badge>
                    )}
                    {isCurrentPlan && (
                      <Badge className="absolute top-3 left-3 bg-lime-500/80 text-white backdrop-blur-sm border border-white/10">
                        Current
                      </Badge>
                    )}

                    <CardHeader className="pb-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold">{plan.label}</h3>
                        {plan.clients && (
                          <p className="text-blue-300 text-sm font-medium">
                            Up to {plan.clients} {procareRole === "trainer" ? "clients" : "patients"}
                          </p>
                        )}
                        <p className="text-2xl font-bold text-white mt-2">
                          ${plan.price % 1 === 0 ? plan.price.toFixed(0) : plan.price.toFixed(2)}
                          <span className="text-sm font-normal text-white/60"> / month</span>
                        </p>
                        <p className="text-xs text-white/50">{plan.blurb}</p>
                      </div>
                    </CardHeader>

                    <Separator className="bg-white/10" />

                    <CardContent className="pt-5 flex-1">
                      <div className="space-y-2.5">
                        {plan.features?.map((feat, fi) => (
                          <div key={fi} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-white/90">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>

                    <Separator className="bg-white/10" />

                    <div className="p-5">
                      <Button
                        className={`w-full font-semibold ${
                          isCurrentPlan
                            ? "bg-lime-500/20 text-lime-300 border border-lime-500/30 cursor-not-allowed"
                            : isMostPopular
                              ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                              : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                        }`}
                        size="lg"
                        disabled={isCurrentPlan}
                        onClick={() => !isCurrentPlan && handleSelectPlan(plan.sku)}
                      >
                        {isCurrentPlan ? "Current Plan" : "Subscribe"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => setProcareRole(null)}
                className="text-white/40 text-xs underline hover:text-white/60 transition-colors"
              >
                Looking for a personal subscription instead?
              </button>
            </div>
          </div>
        )}

        {/* Free Tier Card */}
        <div className="mb-2">
          <Card className="relative bg-black/30 backdrop-blur-lg text-white shadow-xl border border-white/15">
            <CardHeader className="pb-4">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Free</h3>
                <p className="text-sm text-white/80">
                  Explore the app at your own pace
                </p>
                <p className="text-lg font-semibold">$0.00 / month</p>
              </div>
            </CardHeader>
            <Separator className="bg-white/10" />
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {freeFeatures.map((label, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <Separator className="bg-white/10" />
            <div className="p-6">
              <p className="text-xs text-white/50 text-center">
                Upgrade anytime to unlock AI meal generation, builders, and
                more.
              </p>
            </div>
          </Card>
        </div>

        {/* Consumer Plans Grid */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {consumerPlans.map((plan) => {
              const features =
                plan.sku === "mpm_basic"
                  ? basicFeatures
                  : plan.sku === "mpm_premium"
                    ? premiumFeatures
                    : ultimateFeatures;

              return (
                <Card
                  key={plan.sku}
                  className={`relative h-full bg-black/30 backdrop-blur-lg text-white shadow-xl ${
                    plan.sku === "mpm_premium_monthly"
                      ? "border-2 border-orange-400/60 ring-2 ring-orange-400/40"
                      : "border border-white/15"
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
                      <h3 className="text-xl font-bold">{plan.label}</h3>
                      <p className="text-sm text-white/80">{plan.blurb}</p>
                      <p className="text-lg font-semibold">
                        ${plan.price.toFixed(2)} / month
                      </p>
                    </div>
                  </CardHeader>

                  <Separator className="bg-white/10" />

                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {features.map((label, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-white">{label}</span>
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

        {/* Founder Coaching Tier */}
        <div className="mb-16">
            <h2 className="text-xl font-bold mb-6 text-center">
              Personal Guidance
            </h2>

            <Card className="relative bg-black/60 backdrop-blur-lg border border-amber-400/50 ring-2 ring-amber-400/30 text-white shadow-2xl max-w-2xl mx-auto">
              <CardHeader>
                <div className="space-y-3 text-center">
                  <h3 className="text-2xl font-bold">MPM Personal Guidance</h3>
                  <p className="text-white/80 text-sm">
                    Work directly with the founder of My Perfect Meals through
                    structured, in-app, async guidance.
                  </p>
                  <p className="text-2xl font-semibold">$299 / month</p>
                  <p className="text-xs text-white/60">
                    6-Month Commitment · Async Only · In-App Messaging
                  </p>
                </div>
              </CardHeader>

              <Separator className="bg-white/10" />

              <CardContent className="space-y-4 pt-6">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5" />
                    Personalized meal board setup and adjustments
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5" />
                    Direct async messaging with founder
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5" />
                    Decision-free nutrition structure
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5" />
                    Ongoing macro calibration and refinements
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5" />
                    Monitored messaging for safety and professionalism
                  </li>
                </ul>

                <div className="pt-4">
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                    onClick={() => setLocation("/apply-guidance")}
                  >
                    Apply for Personal Guidance
                  </Button>
                </div>

                <p className="text-xs text-center text-white/50 pt-2">
                  This is a structured, professional coaching layer. No video
                  calls. No off-platform contact. Designed for long-term
                  confidence.
                </p>
              </CardContent>
            </Card>
          </div>

        {/* Family Plans Section */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 text-center">Family Plans</h2>
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
                    <p className="text-sm text-white/80">{plan.blurb}</p>
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
                        <span className="text-sm text-white">{label}</span>
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

        {/* More Ways to Use */}
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-6 text-center">
            More Ways to Use My Perfect Meals
          </h2>
          <p className="text-white/60 text-sm text-center mb-6 max-w-2xl mx-auto">
            Need more structure than a subscription plan? My Perfect Meals also offers coaching and guided systems for individuals and families.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="relative bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl overflow-hidden">
              <img
                src="/images/procare-chef.png"
                alt="ProCare Coaching"
                className="w-full h-40 object-cover"
              />
              <CardContent className="pt-4 pb-5 space-y-2">
                <h3 className="text-lg font-bold">ProCare Coaching</h3>
                <p className="text-white/70 text-sm">
                  Some people don't struggle with nutrition knowledge. They struggle with decisions in the moment. ProCare connects you with a real coach inside the My Perfect Meals system so you're not left guessing when real life happens.
                </p>
                <ul className="text-white/50 text-sm space-y-1 mt-2">
                  <li>• Direct messaging with your coach</li>
                  <li>• Guidance before food decisions, not after mistakes</li>
                  <li>• Adjust meals and macros when life changes</li>
                  <li>• Support when stress, travel, or cravings hit</li>
                </ul>
                <Button
                  onClick={() => setLocation("/procare-info")}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  Learn More
                </Button>
              </CardContent>
            </Card>
            <Card className="relative bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl overflow-hidden">
              <img
                src="/images/family-chef.png"
                alt="Family Plan"
                className="w-full h-40 object-cover"
              />
              <CardContent className="pt-4 pb-5 space-y-2">
                <h3 className="text-lg font-bold">Family Plan</h3>
                <p className="text-white/70 text-sm">
                  Trying to eat healthy while everyone in the house eats differently creates chaos. The My Perfect Meals Family Plan gives every person their own personalized nutrition experience while keeping the household organized in one system.
                </p>
                <ul className="text-white/50 text-sm space-y-1 mt-2">
                  <li>• Individual profiles for every family member</li>
                  <li>• Personalized nutrition guidance for each person</li>
                  <li>• Kids, parents, and partners on the same system</li>
                  <li>• One organized plan for the whole household</li>
                </ul>
                <Button
                  onClick={() => setLocation("/family-info")}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  Learn More
                </Button>
        </CardContent>
        </Card>

        <Card className="relative bg-black/30 backdrop-blur-lg border border-amber-500/30 text-white shadow-xl overflow-hidden ring-1 ring-amber-500/20">
            <img
              src="/images/personal-guidance-chef.png"
              alt="MPM Personal Guidance"
              className="w-full h-40 object-cover"
            />
            <CardContent className="pt-4 pb-5 space-y-2">
              <h3 className="text-lg font-bold text-amber-300">MPM Personal Guidance</h3>
              <p className="text-white/70 text-sm">
                Some people don't just want guidance. They want someone experienced helping them structure the entire system. MPM Personal Guidance connects you directly with the founder of My Perfect Meals for structured, in-app coaching and ongoing adjustments.
              </p>
              <ul className="text-white/50 text-sm space-y-1 mt-2">
                <li>• Direct async messaging with the founder</li>
                <li>• Personalized meal board setup and calibration</li>
                <li>• Long-term nutrition structure and accountability</li>
                <li>• Coaching built directly into the My Perfect Meals system</li>
              </ul>
              <Button
                onClick={() => setLocation("/personal-guidance-info")}
                className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30"
              >
                See How Personal Guidance Works
              </Button>
            </CardContent>
          </Card>

        </div>
        </div>

        {/* Signature Kitchen Section */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-amber-600/20 border border-amber-500/30 rounded-full px-4 py-2 mb-4">
              <span className="text-amber-300 text-sm font-semibold tracking-wide uppercase">
                Signature Kitchen
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">Bring Your Brand Into the App</h2>
            <p className="text-white/60 text-sm mt-2 max-w-xl mx-auto">
              Your name, your recipes, your kitchen — built into My Perfect Meals. Creators, chefs, and coaches use Signature Kitchen to reach users at the moment they're deciding what to eat.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <Card className="relative bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl flex flex-col">
              <CardHeader className="pb-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Starter</h3>
                  <p className="text-white/60 text-sm">Get your kitchen in the app and start building your audience.</p>
                  <div className="flex items-baseline gap-1 pt-1">
                    <span className="text-3xl font-bold">$99</span>
                    <span className="text-white/50 text-sm">/ month</span>
                  </div>
                </div>
              </CardHeader>
              <Separator className="bg-white/10" />
              <CardContent className="pt-5 flex-1 space-y-2.5">
                {[
                  "Your kitchen, your name, your recipes in the app",
                  "Up to 10 featured recipes",
                  "Basic brand profile (photo, bio, links)",
                  "Monthly analytics snapshot",
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/90">{f}</span>
                  </div>
                ))}
              </CardContent>
              <Separator className="bg-white/10" />
              <div className="p-5">
                <Button
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold"
                  onClick={() => window.location.href = "mailto:partnerships@myperfectmeals.com?subject=Signature%20Kitchen%20Starter"}
                >
                  Get Started
                </Button>
              </div>
            </Card>

            {/* Pro */}
            <Card className="relative bg-black/40 backdrop-blur-lg border-2 border-amber-400/50 ring-2 ring-amber-400/20 text-white shadow-xl flex flex-col">
              <Badge className="absolute top-3 right-3 bg-amber-500/80 text-white backdrop-blur-sm border border-white/10">
                Most Popular
              </Badge>
              <CardHeader className="pb-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Pro</h3>
                  <p className="text-white/60 text-sm">Full brand integration with priority placement and deeper analytics.</p>
                  <div className="flex items-baseline gap-1 pt-1">
                    <span className="text-3xl font-bold text-amber-300">$199</span>
                    <span className="text-white/50 text-sm">/ month</span>
                  </div>
                </div>
              </CardHeader>
              <Separator className="bg-white/10" />
              <CardContent className="pt-5 flex-1 space-y-2.5">
                {[
                  "Everything in Starter",
                  "Up to 30 featured recipes",
                  "Full brand integration (colors, assets, story)",
                  "Priority placement in discovery",
                  "Quarterly analytics report",
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/90">{f}</span>
                  </div>
                ))}
              </CardContent>
              <Separator className="bg-white/10" />
              <div className="p-5">
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                  onClick={() => window.location.href = "mailto:partnerships@myperfectmeals.com?subject=Signature%20Kitchen%20Pro"}
                >
                  Get Started
                </Button>
              </div>
            </Card>

            {/* Partner */}
            <Card className="relative bg-black/30 backdrop-blur-lg border border-white/15 text-white shadow-xl flex flex-col">
              <CardHeader className="pb-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Partner</h3>
                  <p className="text-white/60 text-sm">Full co-branded kitchen with onboarding placement and dedicated support.</p>
                  <div className="flex items-baseline gap-1 pt-1">
                    <span className="text-3xl font-bold">$499</span>
                    <span className="text-white/50 text-sm">/ month</span>
                  </div>
                </div>
              </CardHeader>
              <Separator className="bg-white/10" />
              <CardContent className="pt-5 flex-1 space-y-2.5">
                {[
                  "Everything in Pro",
                  "Unlimited featured recipes",
                  "Full co-branded kitchen experience",
                  "Featured in onboarding and meal suggestions",
                  "Dedicated account support",
                  "Optional rev-share on plan upgrades you drive",
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/90">{f}</span>
                  </div>
                ))}
              </CardContent>
              <Separator className="bg-white/10" />
              <div className="p-5">
                <Button
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold"
                  onClick={() => window.location.href = "mailto:partnerships@myperfectmeals.com?subject=Signature%20Kitchen%20Partner"}
                >
                  Get Started
                </Button>
              </div>
            </Card>
          </div>

          <p className="text-center text-white/50 text-sm mt-6">
            Looking for a full brand integration or enterprise deal?{" "}
            <a
              href="mailto:partnerships@myperfectmeals.com"
              className="text-amber-400 underline hover:text-amber-300"
            >
              Contact us.
            </a>
          </p>
        </div>

        {/* Affiliate Panel */}
        <div className="mb-12">
          <AffiliateOnPricing />
        </div>

        {/* Apple App Store Compliance Section */}
        <div className="mb-12 space-y-6">
          {/* Subscription Terms - Apple Required */}
          <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-4 text-center space-y-3">
            <p className="text-white/90 text-sm font-bold">
              Start Free. Upgrade When You're Ready.
            </p>
            <p className="text-white/70 text-xs leading-relaxed">
              My Perfect Meals includes a free tier so you can explore the platform before upgrading.
              The free tier gives you access to core features. Paid plans unlock advanced AI coaching,
              personalized meal systems, and full platform capabilities.
            </p>
            <p className="text-white/60 text-xs leading-relaxed">
              Unlock full access with a subscription: Basic – $14.99/month · Premium – $24.99/month · Ultimate – $34.99/month
            </p>
            <p className="text-white/50 text-xs leading-relaxed">
              Payment will be charged to your account at confirmation of purchase.
              Subscriptions automatically renew unless canceled at least 24 hours before the end of the current billing period.
              Your account will be charged for renewal within 24 hours prior to the end of the current period.
              You can manage or cancel your subscription in your account settings.
            </p>
            <div className="flex justify-center gap-4 text-xs">
              <button
                onClick={() => setLocation("/terms-of-service")}
                className="text-lime-400 underline hover:text-lime-300"
              >
                Terms of Service
              </button>
              <button
                onClick={() => window.location.href = "/privacy-policy"}
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
                  const response = await fetch(
                    apiUrl("/api/stripe/subscription-status"),
                    {
                      headers: {
                        "x-auth-token": localStorage.getItem("authToken") || "",
                      },
                    },
                  );

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
                        description:
                          "No active subscription found for your account.",
                      });
                    }
                  } else {
                    toast({
                      title: "Subscription Restored",
                      description:
                        "If you have an active subscription, it has been synced to your account.",
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

          {/* Apple App Store Compliance Section */}
          <div className="mb-12 space-y-6">
            <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-4 text-center space-y-3">
              <p className="text-white/90 text-sm font-bold">
                Start Free. Upgrade When You're Ready.
              </p>
              <p className="text-white/70 text-xs leading-relaxed">
                My Perfect Meals includes a free tier so you can explore the platform before upgrading.
                The free tier gives you access to core features. Paid plans unlock advanced AI coaching,
                personalized meal systems, and full platform capabilities.
              </p>
              <p className="text-white/60 text-xs leading-relaxed">
                Unlock full access with a subscription: Basic – $14.99/month · Premium – $24.99/month · Ultimate – $34.99/month
              </p>
              <p className="text-white/50 text-xs leading-relaxed">
                Payment will be charged to your account at confirmation of purchase.
                Subscriptions automatically renew unless canceled at least 24 hours before the end of the current billing period.
                Your account will be charged for renewal within 24 hours prior to the end of the current period.
                You can manage or cancel your subscription in your account settings.
              </p>
            </div>
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
          <p className="text-white/40 text-xs text-center mt-2">
            <a
              href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 underline hover:text-white/70"
            >
              Terms of Use (EULA)
            </a>
            {" · "}
            <button
              onClick={() => window.location.href = "/privacy-policy"}
              className="text-white/50 underline hover:text-white/70"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
