import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPageTitle } from "@/contexts/PageTitleContext";
import { ProfileSheet } from "@/components/ProfileSheet";
import { HubControlIcon } from "@/components/icons/HubControlIcon";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { ChevronLeft } from "lucide-react";
import { getTierForLookupKey } from "@shared/planFeatures";
import { useTranslation } from "react-i18next";

/** Maps route paths to routeTitles i18n keys */
const ROUTE_KEY_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/macro-counter": "macroCalculator",
  "/select-builder": "mealBuilders",
  "/shopping-list": "shoppingList",
  "/shopping-list-v2": "smartGroceryList",
  "/fridge-rescue": "fridgeRescue",
  "/fridge-rescue-studio": "fridgeRescueStudio",
  "/saved-meals": "savedMeals",
  "/care-team": "careTeam",
  "/care-team/physician": "careTeam",
  "/care-team/trainer": "careTeam",
  "/pro/clients": "myClients",
  "/pro/physician-clients": "physicianClients",
  "/pro/physician": "physicianPortal",
  "/pro-portal": "proPortal",
  "/profile": "settings",
  "/more": "more",
  "/my-biometrics": "myBiometrics",
  "/biometrics": "myBiometrics",
  "/biometrics/body-composition": "bodyComposition",
  "/biometrics/sleep": "sleepTracker",
  "/builders": "mealBuilders",
  "/get-inspiration": "dailyJournal",
  "/pricing": "pricingPlans",
  "/lifestyle": "lifestyle",
  "/lifestyle/my-perfect-pregnancy": "pregnancy",
  "/lifestyle/create-a-dish": "createDish",
  "/lifestyle/beverage-creator": "beverageCreator",
  "/lifestyle/chefs-kitchen": "createDish",
  "/lifestyle/chef-pairings": "chefPairings",
  "/lifestyle/pairings-hub": "pairingsHub",
  "/lifestyle/pairings-ai": "drinkPairings",
  "/lifestyle/wine-list-helper": "wineListHelper",
  "/lifestyle/reduce-drinking-plan": "reduceDrinking",
  "/lifestyle/my-perfect-gatherings": "gatherings",
  "/craving-creator-landing": "cravingCreator",
  "/craving-creator": "cravingCreator",
  "/craving-desserts": "dessertCreator",
  "/craving-studio": "cravingCreator",
  "/dessert-studio": "dessertCreator",
  "/weekly": "weeklyBuilder",
  "/weekly-meal-board": "weeklyBuilder",
  "/plan-builder/classic": "weeklyBuilder",
  "/builder/classic": "weeklyBuilder",
  "/beach-body-meal-board": "performanceBuilder",
  "/diabetic-hub": "diabeticHub",
  "/diabetes-support": "diabetesSupport",
  "/diabetic-menu-builder": "diabeticBuilder",
  "/glp1-hub": "metabolicHub",
  "/glp1-meal-builder": "metabolicBuilder",
  "/glp1-meals-tracking": "metabolicTracking",
  "/anti-inflammatory-menu-builder": "antiInflammatoryBuilder",
  "/social-hub": "mealsAwayFromHome",
  "/social-hub/find": "findMeals",
  "/social-hub/restaurant-guide": "restaurantGuide",
  "/supplement-hub": "supplementHub",
  "/tutorials": "tutorialHub",
  "/learn": "learn",
  "/weaning-off-tool": "weaningOff",
  "/founders": "founders",
  "/apply-guidance": "applyGuidance",
  "/business-center": "businessCenter",
  "/business-center/partners": "partnerPrograms",
  "/business-center/academy": "academy",
  "/business-center/affiliate": "partnerProgram",
  "/business-center/partners/manage": "partnerManagement",
  "/business-dashboard": "organizationDashboard",
  "/business/dashboard": "organizationDashboard",
  "/partner-center": "partnerCenter",
  "/affiliate-dashboard": "partnerRevenueCenter",
  "/creator-studio": "creatorBrandStudio",
  "/business-center/white-label": "whiteLabelSolutions",
  "/business-center/how-partnerships-work": "howPartnershipsWork",
  "/business-center/founding-partner": "foundingPartnerProgram",
  "/business-center/industry": "industryPartnerships",
  "/business-center/healthcare": "healthcarePartnerships",
  "/org-success-center": "organizationSuccessCenter",
  "/procare-welcome": "procareWelcome",
  "/trainer-welcome": "trainerWelcome",
  "/physician-welcome": "physicianWelcome",
  "/pro-launchpad": "proLaunchpad",
};

/** Maps hub-back routes to their hub's routeTitles key */
const HUB_BACK_KEY_MAP: Record<string, { hub: string; key: string }> = {
  "/business-center/partners":              { hub: "/business-center",          key: "businessCenter" },
  "/business-center/how-partnerships-work": { hub: "/business-center/partners", key: "partnerPrograms" },
  "/business-center/founding-partner":      { hub: "/business-center/partners", key: "partnerPrograms" },
  "/business-center/partners/manage":       { hub: "/business-center/partners", key: "partnerPrograms" },
  "/org-success-center":                    { hub: "/business-dashboard",       key: "organizationDashboard" },
  "/beach-body-meal-board":                 { hub: "/performance",              key: "performanceHub" },
  "/diabetic-menu-builder":            { hub: "/diabetic-hub", key: "diabetesHub" },
  "/glp1-meal-builder":               { hub: "/glp1-hub",     key: "metabolicHubBack" },
  "/anti-inflammatory-menu-builder":   { hub: "/diabetic-hub", key: "diabetesHub" },
  "/performance-competition-builder":  { hub: "/performance",  key: "performanceHub" },
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
  free:         "bg-orange-500/15 border border-orange-500/25 text-orange-400",
  paid:         "bg-orange-500/15 border border-orange-500/25 text-orange-400",
  professional: "bg-blue-500/15 border border-blue-500/25 text-blue-400",
};

export default function DesktopHeader() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const contextTitle = useCurrentPageTitle();
  const { appName } = useOrgBranding();
  const { t } = useTranslation("routeTitles");

  function getPageTitle(loc: string): string {
    if (ROUTE_KEY_MAP[loc]) return t(ROUTE_KEY_MAP[loc]);
    for (const [route, key] of Object.entries(ROUTE_KEY_MAP)) {
      if (loc.startsWith(route + "/")) return t(key);
    }
    if (loc.startsWith("/pro/clients/") && loc.includes("/clinician")) return t("patientDashboard");
    if (loc.startsWith("/pro/clients/") && loc.includes("/trainer")) return t("clientDashboard");
    if (loc.startsWith("/pro/clients/") && loc.includes("/board/")) return t("boardView");
    if (loc.startsWith("/pro/clients/")) return t("clientDashboard");
    if (loc.startsWith("/pro/")) return t("professionalWorkspace");
    if (loc.startsWith("/lifestyle/")) return t("lifestyle");
    if (loc.startsWith("/builder") || loc.includes("-builder")) return t("mealBuilder");
    if (loc === "/kitchens") return t("kitchenNetwork");
    if (loc.startsWith("/kitchen/")) return t("signatureKitchen");
    return t("appName");
  }

  const fallbackTitle = getPageTitle(location);
  const title = contextTitle || (fallbackTitle === "Signature Kitchen Experience" ? appName : fallbackTitle);

  const planBadge = getPlanLabel(user);
  const hubBackEntry = HUB_BACK_KEY_MAP[location] ?? null;

  return (
    <header className="h-14 shrink-0 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {hubBackEntry && (
          <button
            onClick={() => setLocation(hubBackEntry.hub)}
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">{t(hubBackEntry.key)}</span>
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
