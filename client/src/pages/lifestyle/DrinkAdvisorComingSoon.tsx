import { useEffect } from "react";
import ComingSoonPresentation from "@/components/coming-soon/ComingSoonPresentation";
import { developmentComingSoonEnabled } from "@/lib/developmentComingSoon";

export default function DrinkAdvisorComingSoon() {
  useEffect(() => {
    if (developmentComingSoonEnabled) {
      document.title = "AI Pairing Advisor — Coming Soon | My Perfect Meals";
    }
  }, []);
  if (!developmentComingSoonEnabled) return null;
  const fromPricing = new URLSearchParams(window.location.search).get("from") === "pricing";
  return (
    <ComingSoonPresentation
      title="AI Pairing Advisor — Coming Soon."
      description="A more conversational way to explore drink pairings, preferences, and food combinations is on the way."
      headerLabel="AI Pairing Advisor"
      backHref={fromPricing ? "/pricing" : "/lifestyle/pairings-hub"}
      backLabel={fromPricing ? "Back to Subscription" : "Back to Drink Intelligence"}
      testId="ai-pairing-advisor-coming-soon"
      tone="orange"
    />
  );
}
