import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPageTitle } from "@/contexts/PageTitleContext";
import { ProfileSheet } from "@/components/ProfileSheet";
import { HubControlIcon } from "@/components/icons/HubControlIcon";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { ChevronLeft } from "lucide-react";
import { getTierForLookupKey } from "@shared/planFeatures";

const HUB_BACK_MAP: Record<string, { hub: string; label: string }> = {
  "/beach-body-meal-board":       { hub: "/performance",  label: "Performance Hub" },
  "/diabetic-menu-builder":       { hub: "/diabetic-hub", label: "Diabetes Hub" },
  "/glp1-meal-builder":           { hub: "/glp1-hub",     label: "Metabolic Hub" },
  "/anti-inflammatory-menu-builder": { hub: "/diabetic-hub", label: "Diabetes Hub" },
  "/performance-competition-builder": { hub: "/performance", label: "Performance Hub" },
};

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/macro-counter": "Macro Calculator",
  "/select-builder": "Meal Builders",
  "/shopping-list": "Shopping List",
  "/shopping-list-v2": "Smart Grocery List",
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
  "/builders": "Meal Builders",
  "/get-inspiration": "Daily Journal & Inspiration",
  "/pricing": "Plans & Pricing",
  "/lifestyle": "Lifestyle Hub",
  "/lifestyle/my-perfect-pregnancy": "My Perfect Pregnancy",
  "/lifestyle/create-a-dish": "Create a Dish",
  "/lifestyle/beverage-creator": "Beverage Creator",
  "/lifestyle/chefs-kitchen": "Create a Dish",
  "/lifestyle/chef-pairings": "Chef Pairings",
  "/lifestyle/pairings-hub": "Pairings Hub",
  "/lifestyle/pairings-ai": "Drink Pairings",
  "/lifestyle/wine-list-helper": "Wine List Helper",
  "/lifestyle/reduce-drinking-plan": "Reduce Drinking Plan",
  "/lifestyle/my-perfect-gatherings": "My Perfect Gatherings",
  "/craving-creator-landing": "Cravings, Sushi & Desserts Hub",
  "/craving-creator": "Craving Creator",
  "/craving-desserts": "Dessert Creator",
  "/craving-studio": "Craving Creator",
  "/dessert-studio": "Dessert Creator",
  "/weekly": "Weekly Meal Builder",
  "/weekly-meal-board": "Weekly Meal Builder",
  "/plan-builder/classic": "Weekly Meal Builder",
  "/builder/classic": "Weekly Meal Builder",
  "/beach-body-meal-board": "Performance Nutrition Builder",
  "/diabetic-hub": "Diabetic Hub",
  "/diabetes-support": "Diabetes Support",
  "/diabetic-menu-builder": "Diabetic Builder",
  "/glp1-hub": "Metabolic Medication Hub",
  "/glp1-meal-builder": "Metabolic Medication Builder",
  "/glp1-meals-tracking": "Metabolic Medication Tracking",
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

type PlanBadgeVariant = "free" | "paid" | "professional";
interface PlanBadgeInfo { text: string; variant: PlanBadgeVariant }

function getPlanLabel(user: { planLookupKey?: string | null; accessTier?: string } | null | undefined): PlanBadgeInfo {
  if (!user) return { text: "Free", variant: "free" };

  const key = (user.planLookupKey ?? "").toLowerCase();
  if (key.includes("procare") || key.includes("trainer") || key.includes("physician")) {
    return { text: "Professional", variant: "professional" };
  }

  const tier = getTierForLookupKey(user.planLookupKey);
  switch (tier) {
    case "basic":    return { text: "Essential", variant: "paid" };
    case "premium":  return { text: "Pro",       variant: "paid" };
    case "ultimate": return { text: "Clinical",  variant: "paid" };
    default:         return { text: "Free",      variant: "free" };
  }
}

const BADGE_CLASSES: Record<PlanBadgeVariant, string> = {
  free:         "bg-white/10 border border-white/15 text-white/50",
  paid:         "bg-orange-500/15 border border-orange-500/25 text-orange-400",
  professional: "bg-blue-500/15 border border-blue-500/25 text-blue-400",
};

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
  if (location === "/kitchens") return "The Kitchen Network";
  if (location.startsWith("/kitchen/")) return "Signature Kitchen";
  return "My Perfect Meals";
}

export default function DesktopHeader() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const contextTitle = useCurrentPageTitle();
  const { appName } = useOrgBranding();

  const fallbackTitle = getPageTitle(location);
  const title = contextTitle || (fallbackTitle === "Signature Kitchen Experience" ? appName : fallbackTitle);
  const planBadge = getPlanLabel(user);
  const hubBack = HUB_BACK_MAP[location] ?? null;

  return (
    <header className="h-14 shrink-0 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {hubBack && (
          <button
            onClick={() => setLocation(hubBack.hub)}
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">{hubBack.label}</span>
          </button>
        )}
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${BADGE_CLASSES[planBadge.variant]}`}>
            {planBadge.text}
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
