import { useState } from "react";
import { useLocation } from "wouter";
import { X, ChevronRight, Wrench } from "lucide-react";

interface NavSection {
  title: string;
  routes: { path: string; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Meal Builders",
    routes: [
      { path: "/weekly-meal-board", label: "Weekly Meal Board" },
      { path: "/beach-body-meal-board", label: "Beach Body Builder" },
      { path: "/diabetic-menu-builder", label: "Diabetic Builder" },
      { path: "/glp1-meal-builder", label: "GLP-1 Builder" },
      { path: "/anti-inflammatory-menu-builder", label: "Anti-Inflammatory Builder" },
      { path: "/performance-competition-builder", label: "Performance Builder" },
      { path: "/pro/general-nutrition-builder", label: "General Nutrition Builder" },
      { path: "/select-builder", label: "Builder Selection Page" },
    ],
  },
  {
    title: "Core Pages",
    routes: [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/home", label: "Home" },
      { path: "/macro-counter", label: "Macro Calculator" },
      { path: "/my-biometrics", label: "My Biometrics" },
      { path: "/biometrics/body-composition", label: "Body Composition" },
      { path: "/biometrics/sleep", label: "Sleep Tracking" },
      { path: "/profile", label: "Profile / Edit" },
      { path: "/shopping-list", label: "Shopping List" },
      { path: "/pricing", label: "Pricing Page" },
      { path: "/planner", label: "Planner" },
      { path: "/checkout/success", label: "Checkout Success" },
      { path: "/admin-moderation", label: "Admin Moderation" },
      { path: "/cafeteria-setup", label: "Cafeteria Setup" },
      { path: "/ab-testing-demo", label: "AB Testing Demo" },
    ],
  },
  {
    title: "Lifestyle & Craving",
    routes: [
      { path: "/lifestyle", label: "Lifestyle Landing" },
      { path: "/lifestyle/chefs-kitchen", label: "Chef's Kitchen" },
      { path: "/craving-creator", label: "Craving Creator" },
      { path: "/craving-creator-landing", label: "Craving Landing" },
      { path: "/craving-studio", label: "Craving Studio" },
      { path: "/craving-desserts", label: "Dessert Creator" },
      { path: "/dessert-studio", label: "Dessert Studio" },
      { path: "/craving-presets", label: "Craving Presets" },
      { path: "/fridge-rescue", label: "Fridge Rescue" },
      { path: "/fridge-rescue-studio", label: "Fridge Rescue Studio" },
    ],
  },
  {
    title: "Physician Hub",
    routes: [
      { path: "/diabetic-hub", label: "Diabetic Hub" },
      { path: "/diabetes-support", label: "Diabetes Support" },
      { path: "/glp1-hub", label: "GLP-1 Hub" },
      { path: "/glp1-meals-tracking", label: "GLP-1 Meals Tracking" },
    ],
  },
  {
    title: "ProCare & Trainer",
    routes: [
      { path: "/procare-cover", label: "ProCare Cover" },
      { path: "/pro-portal", label: "Pro Portal" },
      { path: "/pro/physician", label: "Physician Portal" },
      { path: "/pro/clients", label: "Pro Clients" },
      { path: "/care-team", label: "Care Team" },
      { path: "/care-team/physician", label: "Physician Care Team" },
      { path: "/care-team/trainer", label: "Trainer Care Team" },
      { path: "/pro-client-dashboard", label: "Pro Client Dashboard" },
    ],
  },
  {
    title: "Alcohol Hub",
    routes: [
      { path: "/alcohol-hub", label: "Alcohol Hub" },
      { path: "/alcohol/lean-and-social", label: "Lean & Social" },
      { path: "/alcohol-smart-sips", label: "Alcohol Smart Sips" },
      { path: "/mocktails-low-cal-mixers", label: "Mocktails" },
      { path: "/beer-pairing", label: "Beer Pairing" },
      { path: "/bourbon-spirits", label: "Bourbon & Spirits" },
      { path: "/wine-pairing", label: "Wine Pairing" },
      { path: "/meal-pairing-ai", label: "Meal Pairing AI" },
      { path: "/alcohol-log", label: "Alcohol Log" },
      { path: "/weaning-off-tool", label: "Weaning Off Tool" },
    ],
  },
  {
    title: "Social Hub",
    routes: [
      { path: "/social-hub", label: "Social Hub" },
      { path: "/social-hub/find", label: "Find Meals" },
      { path: "/social-hub/restaurant-guide", label: "Restaurant Guide" },
    ],
  },
  {
    title: "Kids & Family",
    routes: [
      { path: "/kids-meals", label: "Kids Meals Hub" },
      { path: "/toddler-meals", label: "Toddler Meals Hub" },
      { path: "/healthy-kids-meals", label: "Healthy Kids Meals" },
      { path: "/family-info", label: "Family Info" },
      { path: "/glp1-meals-tracking", label: "GLP-1 Meals Tracking" },
    ],
  },
  {
    title: "Other",
    routes: [
      { path: "/get-inspiration", label: "Get Inspiration" },
      { path: "/learn", label: "Learn" },
      { path: "/tutorials", label: "Tutorials" },
      { path: "/supplement-hub", label: "Supplement Hub" },
      { path: "/supplement-education", label: "Supplement Education" },
      { path: "/founders", label: "Founders" },
      { path: "/privacy", label: "Privacy & Security" },
      { path: "/privacy-policy", label: "Privacy Policy" },
      { path: "/terms", label: "Terms of Service" },
    ],
  },
  {
    title: "Auth & Onboarding",
    routes: [
      { path: "/welcome", label: "Welcome" },
      { path: "/auth", label: "Auth / Login" },
      { path: "/guest-builder", label: "Guest Builder" },
      { path: "/onboarding", label: "Onboarding" },
      { path: "/onboarding/extended", label: "Extended Onboarding" },
    ],
  },
];

export default function DevNavigator() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["Meal Builders"]));

  if (import.meta.env.MODE !== "development") return null;

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const navigate = (path: string) => {
    setLocation(path);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-2 right-16 z-[9999] w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-lg active:scale-[0.95]"
        aria-label="Dev Navigator"
      >
        <Wrench className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-500" />
          <span className="text-white font-semibold text-sm">Dev Navigator</span>
          <span className="text-[10px] bg-amber-600/30 text-amber-400 px-1.5 py-0.5 rounded-full">DEV ONLY</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-[0.95]"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="p-3 space-y-2 pb-24">
        {NAV_SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.title);
          return (
            <div key={section.title} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.99]"
              >
                <span className="text-white text-sm font-medium">{section.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/40">{section.routes.length}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-white/5">
                  {section.routes.map((route) => (
                    <button
                      key={route.path}
                      onClick={() => navigate(route.path)}
                      className="w-full flex items-center justify-between px-4 py-2.5 active:bg-white/10 transition-colors"
                    >
                      <span className="text-white/80 text-sm">{route.label}</span>
                      <span className="text-[10px] text-white/30 font-mono">{route.path}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
