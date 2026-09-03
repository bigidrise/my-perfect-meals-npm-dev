import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, HandCoins } from "lucide-react";

const AFFILIATE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSew1J44zIE0skuvhGzEjc_AYcMZxrtla7Py0Jh2llUzpOZVWQ/viewform";

export function AffiliateJoinCard() {
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
          onClick={() => window.open(AFFILIATE_FORM_URL, "_blank", "noopener,noreferrer")}
          className="flex items-center gap-2 w-full"
          data-testid="button-check-eligibility"
        >
          <HandCoins className="w-4 h-4" />
          Apply to Join
        </Button>
      </CardContent>
    </Card>
  );
}
