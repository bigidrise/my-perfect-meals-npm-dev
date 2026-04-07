import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPageTitle } from "@/contexts/PageTitleContext";
import { ProfileSheet } from "@/components/ProfileSheet";
import { HubControlIcon } from "@/components/icons/HubControlIcon";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/macro-counter": "Macro Calculator",
  "/select-builder": "Meal Builders",
  "/shopping-list": "Shopping List",
  "/shopping-list-v2": "Shopping List",
  "/fridge-rescue": "Fridge Rescue",
  "/fridge-rescue-studio": "Fridge Rescue Studio",
  "/saved-meals": "Saved Meals",
  "/care-team": "Care Team",
  "/care-team/physician": "Care Team",
  "/care-team/trainer": "Care Team",
  "/pro/clients": "My Clients",
  "/pro/physician-clients": "Physician Clients",
  "/pro/physician": "Physician Portal",
  "/pro-portal": "Pro Portal",
  "/profile": "Settings",
  "/more": "More",
  "/my-biometrics": "My Biometrics",
  "/biometrics": "My Biometrics",
  "/biometrics/body-composition": "Body Composition",
  "/biometrics/sleep": "Sleep Tracker",
  "/planner": "Meal Planner",
  "/get-inspiration": "Daily Journal & Inspiration",
  "/pricing": "Plans & Pricing",
  "/lifestyle": "Lifestyle Hub",
  "/lifestyle/create-a-dish": "Create a Dish",
  "/lifestyle/beverage-creator": "Beverage Creator",
  "/lifestyle/chefs-kitchen": "Chef's Kitchen",
  "/lifestyle/chef-pairings": "Chef Pairings",
  "/lifestyle/pairings-hub": "Pairings Hub",
  "/lifestyle/pairings-ai": "Drink Pairings",
  "/lifestyle/wine-list-helper": "Wine List Helper",
  "/lifestyle/reduce-drinking-plan": "Reduce Drinking Plan",
  "/craving-creator-landing": "Craving Creator Hub",
  "/craving-creator": "Craving Creator",
  "/craving-desserts": "Dessert Creator",
  "/craving-studio": "Craving Creator",
  "/dessert-studio": "Dessert Creator",
  "/weekly": "Weekly Meal Builder",
  "/weekly-meal-board": "Weekly Meal Builder",
  "/plan-builder/classic": "Weekly Meal Builder",
  "/builder/classic": "Weekly Meal Builder",
  "/beach-body-meal-board": "Beach Body Builder",
  "/diabetic-hub": "Diabetic Hub",
  "/diabetes-support": "Diabetes Support",
  "/diabetic-menu-builder": "Diabetic Builder",
  "/glp1-hub": "GLP-1 Hub",
  "/glp1-meal-builder": "GLP-1 Builder",
  "/glp1-meals-tracking": "GLP-1 Tracking",
  "/anti-inflammatory-menu-builder": "Anti-Inflammatory Builder",
  "/social-hub": "Social Hub",
  "/social-hub/find": "Find Meals",
  "/social-hub/restaurant-guide": "Restaurant Guide",
  "/supplement-hub": "Supplement Hub",
  "/tutorials": "Tutorial Hub",
  "/learn": "Learn",
  "/weaning-off-tool": "Weaning Off Tool",
  "/founders": "Founders",
  "/apply-guidance": "Apply Guidance",
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
  if (location.startsWith("/pro/clients/") && location.includes("/clinician")) return "Patient Dashboard";
  if (location.startsWith("/pro/clients/") && location.includes("/trainer")) return "Client Dashboard";
  if (location.startsWith("/pro/clients/") && location.includes("/board/")) return "Board View";
  if (location.startsWith("/pro/clients/")) return "Client Dashboard";
  if (location.startsWith("/pro/")) return "Professional Workspace";
  if (location.startsWith("/lifestyle/")) return "Lifestyle Hub";
  if (location.startsWith("/builder") || location.includes("-builder")) return "Meal Builder";
  return "My Perfect Meals";
}

export default function DesktopHeader() {
  const [location] = useLocation();
  const { user } = useAuth();
  const contextTitle = useCurrentPageTitle();

  const title = contextTitle || getPageTitle(location);
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
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <span className="text-xs font-semibold text-orange-400">Hub</span>
            <HubControlIcon size="md" />
          </button>
        </ProfileSheet>
      </div>
    </header>
  );
}
