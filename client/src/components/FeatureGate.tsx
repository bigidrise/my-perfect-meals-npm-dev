import { useAuth } from "@/contexts/AuthContext";
import { hasFeature, Entitlement, getUpgradePlanForFeature } from "@/lib/entitlements";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { startCheckout, IOS_BLOCK_ERROR } from "@/lib/checkout";
import { isIosNativeShell, IOS_PAYMENT_MESSAGE } from "@/lib/platform";
import { useToast } from "@/hooks/use-toast";

interface FeatureGateProps {
  feature: Entitlement;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  if (hasFeature(user, feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const upgradePlan = getUpgradePlanForFeature(feature);
  const planNames: Record<string, string> = {
    mpm_basic_monthly: "Basic",
    mpm_upgrade_monthly: "Premium",
    mpm_ultimate_monthly: "Ultimate",
    mpm_procare_monthly: "ProCare",
  };

  const handleUpgrade = async () => {
    if (isIosNativeShell()) {
      toast({ ...IOS_PAYMENT_MESSAGE, variant: "default" });
      return;
    }

    try {
      await startCheckout(upgradePlan);
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

  return (
    <Card className="bg-black/30 backdrop-blur-lg border border-white/15 text-white">
      <CardContent className="pt-6 pb-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-purple-500/20 p-4">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">Premium Feature</h3>
          <p className="text-white/70">
            This feature requires the {planNames[upgradePlan]} plan or higher
          </p>
        </div>
        <Button
          onClick={handleUpgrade}
          className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
          data-testid="button-upgrade-feature"
        >
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
}
