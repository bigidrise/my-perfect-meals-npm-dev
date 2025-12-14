import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Megaphone, HandCoins } from "lucide-react";

export function AffiliateJoinCard() {
  const [, setLocation] = useLocation();

  return (
    <Card className="bg-black/60 border-white/10 text-white backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Founding Affiliate (Invite-Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-white/80">
          Recruit <span className="font-semibold">paid beta testers</span> and earn <span className="font-semibold">25% recurring</span>.
          Only 5 alpha testers are invited for this pilot.
        </p>
        <Button 
          onClick={() => setLocation("/affiliates")} 
          className="flex items-center gap-2 w-full"
          data-testid="button-check-eligibility"
        >
          <HandCoins className="w-4 h-4" />
          Check Eligibility
        </Button>
      </CardContent>
    </Card>
  );
}
