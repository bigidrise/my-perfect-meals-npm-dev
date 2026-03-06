import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileSheet } from "@/components/ProfileSheet";
import { HubControlIcon } from "@/components/icons/HubControlIcon";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/macro-counter": "Macro Calculator",
  "/select-builder": "Meal Builders",
  "/shopping-list": "Shopping List",
  "/shopping-list-v2": "Shopping List",
  "/fridge-rescue": "Fridge Rescue",
  "/saved-meals": "Saved Meals",
  "/care-team/physician": "Care Team",
  "/care-team/trainer": "Care Team",
  "/pro/clients": "Professional Workspace",
  "/pro/physician-clients": "Professional Workspace",
  "/profile": "Settings",
  "/more": "More",
  "/my-biometrics": "My Biometrics",
  "/planner": "Meal Planner",
  "/get-inspiration": "Daily Journal & Inspiration",
  "/pricing": "Plans & Pricing",
  "/lifestyle": "Lifestyle",
  "/lifestyle/beverage-creator": "Beverage Creator",
  "/lifestyle/chefs-kitchen": "Chef's Kitchen",
  "/craving-creator-landing": "Craving Creator",
  "/craving-desserts": "Dessert Creator",
};

function getPlanLabel(planLookupKey?: string | null): string | null {
  if (!planLookupKey) return null;
  const key = planLookupKey.toLowerCase();
  if (key.includes("ultimate")) return "Ultimate";
  if (key.includes("premium")) return "Premium";
  if (key.includes("basic")) return "Basic";
  if (key.includes("trainer") || key.includes("physician") || key.includes("procare")) return "Professional";
  if (key.includes("family")) return "Family";
  if (key.includes("guidance")) return "Guidance";
  return null;
}

function getPageTitle(location: string): string {
  if (ROUTE_TITLES[location]) return ROUTE_TITLES[location];
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (location.startsWith(route + "/")) return title;
  }
  if (location.startsWith("/pro/")) return "Professional Workspace";
  if (location.startsWith("/builder") || location.includes("-builder")) return "Meal Builder";
  return "My Perfect Meals";
}

export default function DesktopHeader() {
  const [location] = useLocation();
  const { user } = useAuth();

  const title = getPageTitle(location);
  const planLabel = getPlanLabel(user?.planLookupKey);

  return (
    <header className="h-14 shrink-0 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-3">
        {planLabel && (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
            {planLabel}
          </span>
        )}
        <ProfileSheet>
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <HubControlIcon size="md" />
          </button>
        </ProfileSheet>
      </div>
    </header>
  );
}
