import React, { lazy } from "react";
import { Switch, Route, useLocation } from "wouter";
import GeneralNutritionBuilder from "@/pages/pro/GeneralNutritionBuilder";
import ScrollRestorer from "@/components/ScrollRestorer";
import BottomNav from "@/components/BottomNav";
import { withPageErrorBoundary } from "@/components/PageErrorBoundary";
// import MealLogHistoryPage from "@/pages/MealLogHistoryPage"; // TEMPORARILY DISABLED - File missing
import ABTestingDemo from "@/pages/ABTestingDemo";
import { FEATURES } from "@/utils/features";
import ComingSoon from "@/pages/ComingSoon";

// Plan Builder Pages
// DELETED: PlanBuilderTurbo, PlanBuilderHub, CompetitionBeachbodyBoard
import Planner from "@/pages/Planner";
import WeeklyMealBoard from "@/pages/WeeklyMealBoard";
import BeachBodyMealBoard from "@/pages/BeachBodyMealBoard";
import MacroCounter from "@/pages/MacroCounter";
// DELETED: AdultBeverageHubPage
import LifestyleLandingPage from "@/pages/LifestyleLandingPage"; // Renamed from EmotionAIHub
import HealthyKidsMeals from "@/pages/HealthyKidsMeals";
import GLP1MealsTracking from "@/pages/GLP1MealsTracking";
import KidsMealsHub from "@/pages/kids-meals-hub";
import ToddlersMealsHub from "@/pages/toddlers-meals-hub";

// New Simple Plan page
// Page imports
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import DashboardNew from "@/pages/DashboardNew";
import Learn from "@/pages/Learn";
import ProfileNew from "@/pages/Profile";
import PrivacySecurity from "@/pages/privacy";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
// Standalone 3-step onboarding for all onboarding routes
import OnboardingStandalone from "@/pages/onboarding-standalone";
import Welcome from "@/pages/Welcome";
import GuestBuilder from "@/pages/GuestBuilder";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PricingPage from "@/pages/PricingPage";
import MealBuilderSelection from "@/pages/MealBuilderSelection";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import FamilyInfoPage from "@/pages/FamilyInfoPage";
import AdminModerationPage from "@/pages/admin-moderation";
// DELETED: CommunityTestPage, CommunityPage (no page component exists)

// Additional component imports
// DELETED: MealPlanningHubRevised (comprehensive-meal-planning-revised)
import CravingCreator from "@/pages/craving-creator";
import FridgeRescuePage from "@/pages/fridge-rescue";
// DELETED: RestaurantGuidePage (moved to _quarantine - replaced by SocialRestaurantGuide)
// DELETED: PotluckPlanner, ToddlersMealsHub, CampingMealsHubPage, TailgatingHub, SmartWeekBuilder, MealsForKidsHubPage, KidsDrinksHubPage, KidsLunchboxPlanner, KidsIMadeItMyself
import {
  BreakfastMealsHub,
  LunchMealsHub,
  DinnerMealsHub,
  SnacksMealsHub,
} from "@/features/meals/MealHubFactory";

// DELETED: GameHub, AlcoholHub, WhyVsWhat

// Dashboard navigation pages
import TutorialHub from "@/pages/TutorialHub";
import MyBiometrics from "@/pages/my-biometrics";
import BodyComposition from "@/pages/biometrics/body-composition";
import Sleep from "@/pages/biometrics/sleep";
import GetInspiration from "@/pages/GetInspiration";

// DELETED: All non-MVP pages (hubs, specialty features, etc.)

// ✅ NEW: Unified Food Logging
// import FoodLogToday from "@/pages/FoodLogToday"; // TEMPORARILY DISABLED - File missing
// import FoodLogHistory from "@/pages/FoodLogHistory"; // TEMPORARILY DISABLED - File missing

// DELETED: WomensHealthHub, WomensHealthHubEducational, MensHealthHubEducational, WellnessHub, DailyJournalPage

// Shopping List (core MVP feature)
import ShoppingListMasterView from "@/pages/ShoppingListMasterView";

// Pro Portal (core MVP feature)
import CareTeam from "@/pages/CareTeam";
import ProCareCover from "@/pages/ProCareCover";
import ProPortal from "@/pages/ProPortal";
import ProClients from "@/pages/pro/ProClients";
import ProClientDashboard from "@/pages/pro/ProClientDashboard";
import TrainerClientDashboard from "@/pages/pro/TrainerClientDashboard";
import ClinicianClientDashboard from "@/pages/pro/ClinicianClientDashboard";
import PerformanceCompetitionBuilder from "@/pages/pro/PerformanceCompetitionBuilder";

// Physician Hub Pages
import DiabeticHub from "@/pages/physician/DiabeticHub";
import DiabetesSupportPage from "@/pages/physician/DiabetesSupportPage";
import DiabeticMenuBuilder from "@/pages/physician/DiabeticMenuBuilder";
import GLP1Hub from "@/pages/physician/GLP1Hub";
import GLP1MealBuilder from "@/pages/physician/GLP1MealBuilder";
// QUARANTINED: MedicalDietsHub moved to _quarantine (not in active navigation)
import AntiInflammatoryMenuBuilder from "@/pages/physician/AntiInflammatoryMenuBuilder";

// Craving pages
// DELETED: CravingHub (moved to _quarantine - replaced by CravingCreatorLanding)
import CravingCreatorLanding from "@/pages/CravingCreatorLanding";
import CravingDessertCreator from "@/pages/CravingDessertCreator";
import CravingPresets from "@/pages/CravingPresets";

// Alcohol Hub pages
import AlcoholHubLanding from "@/pages/AlcoholHubLanding";
import AlcoholLeanAndSocial from "@/pages/AlcoholLeanAndSocial";
import AlcoholSmartSips from "@/pages/AlcoholSmartSips";
import MocktailsLowCalMixers from "@/pages/mocktails-low-cal-mixers";
import BeerPairing from "@/pages/beer-pairing";
import BourbonSpirits from "@/pages/bourbon-spirits";
import AlcoholLog from "@/pages/alcohol-log";
import MealPairingAI from "@/pages/meal-pairing-ai";
import WeaningOffTool from "@/pages/weaning-off-tool";
import WinePairing from "@/pages/wine-pairing";

// DELETED: MealFinder (moved to _quarantine - replaced by SocialFindMeals)

// Socializing Hub pages
import SocializingHub from "@/pages/SocializingHub";
import SocialFindMeals from "@/pages/SocialFindMeals";
import SocialRestaurantGuide from "@/pages/SocialRestaurantGuide";

// Founders page
import FoundersPage from "@/pages/Founders";

// SimpleWalkthroughDemo quarantined - replaced by Quick Tour system

// DELETED: AffiliatesPage

// Vitals Logger - Creating a placeholder for this route
const VitalsLogger = () => <div>Vitals Logger - Coming Soon</div>;

// Supplement Hub imports
// REMOVED: SupplementHubLanding (landing page not used - Copilot now routes to /supplement-hub directly)
import SupplementHub from "@/pages/supplement-hub";
import SupplementEducationPage from "@/pages/supplement-education";

// Wrapper components for Performance Competition Builder boards
const PerformanceCompetitionBuilderStandalone = (_props: any) => (
  <PerformanceCompetitionBuilder mode="athlete" />
);
const PerformanceCompetitionBuilderProCare = (_props: any) => (
  <PerformanceCompetitionBuilder mode="procare" />
);

export default function Router() {
  const [location] = useLocation();

  // Add fallback protection
  if (!location) {
    return <DashboardNew />;
  }

  // Pages where BottomNav should NOT appear (pre-login/onboarding pages only)
  const hideBottomNavRoutes = [
    "/",
    "/auth",
    "/welcome",
    "/guest-builder",
    "/forgot-password",
    "/reset-password",
    "/onboarding",
    "/onboarding-v2",
    "/onboarding-legacy",
    "/pricing",
    "/checkout/success",
  ];

  const shouldShowBottomNav = !hideBottomNavRoutes.includes(location);

  // The rest of the original routes are kept below.

  return (
    <>
      <ScrollRestorer />
      <Switch>
        {/* Core Routes */}
        <Route path="/welcome" component={Welcome} />
        <Route path="/guest-builder" component={GuestBuilder} />
        <Route path="/home" component={Home} />
        <Route path="/auth" component={Auth} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/paywall" component={PricingPage} />
        <Route path="/select-builder" component={MealBuilderSelection} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/family-info" component={FamilyInfoPage} />
        <Route path="/admin-moderation" component={AdminModerationPage} />
        {/* DELETED: CommunityTestPage, CommunityPage routes */}
        <Route
          path="/onboarding"
          component={withPageErrorBoundary(OnboardingStandalone, "Onboarding")}
        />
        <Route
          path="/onboarding-v2"
          component={withPageErrorBoundary(OnboardingStandalone, "Onboarding V2")}
        />
        <Route
          path="/onboarding-legacy"
          component={withPageErrorBoundary(OnboardingStandalone, "Onboarding")}
        />
        <Route
          path="/dashboard"
          component={withPageErrorBoundary(DashboardNew, "Dashboard")}
        />
        <Route path="/tutorials" component={TutorialHub} />
        <Route path="/learn" component={Learn} />
        <Route path="/get-inspiration" component={GetInspiration} />
        <Route path="/privacy" component={PrivacySecurity} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        {/* Profile functionality in My Hub (ProfileSheet) - no separate /profile page needed */}
        {/* Settings functionality now in My Hub (ProfileSheet) */}
        {/* DELETED: AffiliatesPage, FoundersPage, FoundersSubmit, Changelog routes */}
        {/* DELETED: MealPlanning, LowGlycemicCarbPage, AiMealCreatorPage, MealPlanningHubRevised routes */}
        <Route path="/lifestyle" component={LifestyleLandingPage} />
        <Route path="/healthy-kids-meals" component={HealthyKidsMeals} />
        <Route path="/kids-meals" component={KidsMealsHub} />
        <Route path="/toddler-meals" component={ToddlersMealsHub} />
        <Route path="/glp1-meals-tracking" component={GLP1MealsTracking} />
        <Route path="/craving-creator" component={CravingCreator} />
        <Route path="/fridge-rescue" component={FridgeRescuePage} />
        <Route path="/ab-testing-demo" component={ABTestingDemo} />
        {/* DELETED: HolidayFeastPlannerPage, MealFinderPage, BreakfastMealsHub, LunchMealsHub, DinnerMealsHub, SnacksMealsHub, CulturalCuisinesPage, VegetableFiberInfo, PotluckPlanner, RestaurantGuide (old) routes */}
        {/* Socializing Hub Routes */}
        <Route path="/social-hub" component={SocializingHub} />
        <Route path="/social-hub/find" component={SocialFindMeals} />
        <Route path="/social-hub/restaurant-guide" component={SocialRestaurantGuide} />
        {/* DELETED: SmartWeekBuilder, AdultBeverageHubPage routes */}
        <Route
          path="/macro-counter"
          component={withPageErrorBoundary(MacroCounter, "Macro Counter")}
        />
        {/* DELETED: All kids meal routes, all alcohol hub routes */}
        <Route
          path="/my-biometrics"
          component={withPageErrorBoundary(MyBiometrics, "My Biometrics")}
        />
        {/* Biometric sub-pages */}
        <Route
          path="/biometrics"
          component={withPageErrorBoundary(MyBiometrics, "Biometrics")}
        />
        <Route
          path="/biometrics/body-composition"
          component={withPageErrorBoundary(BodyComposition, "Body Composition")}
        />
        <Route
          path="/biometrics/sleep"
          component={withPageErrorBoundary(Sleep, "Sleep Tracking")}
        />
        {/* ✅ NEW: Unified Food Logging Routes */}
        {/* <Route path="/food" component={FoodLogToday} /> */}{" "}
        {/* TEMPORARILY DISABLED - File missing */}
        {/* <Route path="/food/history" component={FoodLogHistory} /> */}{" "}
        {/* TEMPORARILY DISABLED - File missing */}
        {/* 🔄 REDIRECTS: Old meal logging URLs to new unified system */}
        <Route path="/meal-log/history">
          {() => {
            window.location.href = "/food/history";
            return null;
          }}
        </Route>
        <Route path="/meal-log">
          {() => {
            window.location.href = "/food";
            return null;
          }}
        </Route>
        {/* DELETED: WellnessHub, DailyJournalPage, WomensHealthHubEducational, MensHealthHubEducational routes */}
        {/* DELETED: Redirects to deleted hormone hub pages */}
        {/* DELETED: InspirationJournal, DailyJournal, WeeklyNewsletter, TrackWater routes */}
        {/* DELETED: All meal planning hub pages, specialty routes: MasterShoppingList, VoiceSettings, SimplePlanPage, SupplementHub, LabValueSupport, LearnToCook, KidsMealsHub, BloodSugarHub, BodyComposition, CycleTracking, Calendar, SupplementEducation, SuccessStories, DailySummary, WinePairing, MealPairingAI, UpgradePage, WellnessCompanion, StressEatingSolution, PlanBuilderHub */}
        {/* Cafeteria Setup route: show page if enabled; otherwise Coming Soon */}
        <Route path="/cafeteria-setup">
          <ComingSoon
            title="Cafeteria Setup"
            blurb="We'll auto-generate meals from your onboarding preferences here."
            hint="For now, use Add from Menu or Fridge Rescue."
            ctaLabel="Open Weekly Meal Board"
            ctaHref="/weekly-meal-board"
          />
        </Route>
        {/* DELETED: TemplateHub route */}
        <Route
          path="/weekly"
          component={withPageErrorBoundary(
            WeeklyMealBoard,
            "Weekly Meal Board",
          )}
        />
        {/* DELETED: PlanBuilderTurbo, ProteinPlannerPage, PlanBuilderHub, CompetitionBeachbodyBoard routes */}
        <Route
          path="/planner"
          component={withPageErrorBoundary(Planner, "Planner")}
        />
        <Route
          path="/weekly-meal-board"
          component={withPageErrorBoundary(
            WeeklyMealBoard,
            "Weekly Meal Board",
          )}
        />
        <Route path="/beach-body-meal-board" component={BeachBodyMealBoard} />
        {/* Legacy redirects - redirect Classic Builder to Weekly Meal Board */}
        <Route
          path="/plan-builder/classic"
          component={withPageErrorBoundary(
            WeeklyMealBoard,
            "Weekly Meal Board",
          )}
        />
        <Route
          path="/builder/classic"
          component={withPageErrorBoundary(
            WeeklyMealBoard,
            "Weekly Meal Board",
          )}
        />
        {/* DELETED: PlanBuilderTurbo route */}
        {/* DELETED: CravingHub, CravingPresetsPage, SearchPage, PhysicianReportView, SmartMenuBuilder routes */}
        {/* DELETED: GLP1Hub, GLP1MealBuilder, SpecialtyDietsHub, HormonePresetDetail, HormonePreviewWeeklyBoard, ToughDayCompanion, DiabetesSupport routes */}
        {/* Health Support Routes */}
        {/* Meal Log History Route */}
        {/* <Route path="/meal-log-history" component={MealLogHistoryPage} /> */}{" "}
        {/* TEMPORARILY DISABLED - File missing */}
        {/* Shopping List Routes */}
        <Route
          path="/shopping-list-v2"
          component={withPageErrorBoundary(
            ShoppingListMasterView,
            "Shopping List",
          )}
        />
        <Route
          path="/shopping-list"
          component={withPageErrorBoundary(
            ShoppingListMasterView,
            "Shopping List",
          )}
        />
        {/* ProCare Feature Routes (ProCare Cover → Care Team → Pro Portal → Client Dashboard → Performance & Competition Builder) */}
        <Route
          path="/procare-cover"
          component={withPageErrorBoundary(ProCareCover, "ProCare Cover")}
        />
        <Route
          path="/care-team"
          component={withPageErrorBoundary(CareTeam, "Care Team")}
        />
        <Route
          path="/pro-portal"
          component={withPageErrorBoundary(ProPortal, "Pro Portal")}
        />
        <Route
          path="/pro/clients"
          component={withPageErrorBoundary(ProClients, "Pro Clients")}
        />
        <Route
          path="/pro/clients/:id"
          component={withPageErrorBoundary(
            ProClientDashboard,
            "Client Dashboard",
          )}
        />
        <Route
          path="/pro/clients/:id/trainer"
          component={withPageErrorBoundary(
            TrainerClientDashboard,
            "Trainer Dashboard",
          )}
        />
        <Route
          path="/pro/clients/:id/clinician"
          component={withPageErrorBoundary(
            ClinicianClientDashboard,
            "Clinician Dashboard",
          )}
        />
        <Route
          path="/pro-client-dashboard"
          component={withPageErrorBoundary(
            ProClientDashboard,
            "Client Dashboard",
          )}
        />
        <Route
          path="/performance-competition-builder"
          component={PerformanceCompetitionBuilderStandalone}
        />
        <Route
          path="/pro/clients/:id/general-nutrition-builder"
          component={GeneralNutritionBuilder}
        />
        <Route
          path="/pro/clients/:id/performance-competition-builder"
          component={PerformanceCompetitionBuilderProCare}
        />
        {/* ProCare routes for physician builders */}
        <Route
          path="/pro/clients/:id/diabetic-builder"
          component={DiabeticMenuBuilder}
        />
        <Route
          path="/pro/clients/:id/glp1-builder"
          component={GLP1MealBuilder}
        />
        <Route
          path="/pro/clients/:id/anti-inflammatory-builder"
          component={AntiInflammatoryMenuBuilder}
        />
        {/* Physician Hub Routes (Diabetic, GLP-1, Medical Diets, Clinical Lifestyle) */}
        <Route
          path="/diabetic-hub"
          component={withPageErrorBoundary(DiabeticHub, "Diabetic Hub")}
        />
        <Route
          path="/diabetes-support"
          component={withPageErrorBoundary(
            DiabetesSupportPage,
            "Diabetes Support",
          )}
        />
        <Route
          path="/diabetic-menu-builder"
          component={withPageErrorBoundary(
            DiabeticMenuBuilder,
            "Diabetic Menu Builder",
          )}
        />
        <Route
          path="/glp1-hub"
          component={withPageErrorBoundary(GLP1Hub, "GLP-1 Hub")}
        />
        <Route
          path="/glp1-meal-builder"
          component={withPageErrorBoundary(
            GLP1MealBuilder,
            "GLP-1 Meal Builder",
          )}
        />
        {/* QUARANTINED: /medical-diets-hub route removed - MedicalDietsHub moved to _quarantine */}
        <Route
          path="/anti-inflammatory-menu-builder"
          component={withPageErrorBoundary(
            AntiInflammatoryMenuBuilder,
            "Anti-Inflammatory Menu Builder",
          )}
        />
        {/* Craving Creator Routes */}
        <Route
          path="/craving-creator-landing"
          component={CravingCreatorLanding}
        />
        {/* DELETED: /craving-hub route (old CravingHub moved to _quarantine - use /craving-creator-landing instead) */}
        <Route path="/craving-desserts" component={CravingDessertCreator} />
        <Route path="/craving-presets" component={CravingPresets} />
        {/* Alcohol Hub Routes */}
        <Route path="/alcohol-hub" component={AlcoholHubLanding} />
        <Route
          path="/alcohol/lean-and-social"
          component={AlcoholLeanAndSocial}
        />
        <Route path="/alcohol-smart-sips" component={AlcoholSmartSips} />
        <Route
          path="/mocktails-low-cal-mixers"
          component={MocktailsLowCalMixers}
        />
        <Route path="/beer-pairing" component={BeerPairing} />
        <Route path="/bourbon-spirits" component={BourbonSpirits} />
        <Route path="/alcohol-log" component={AlcoholLog} />
        <Route path="/meal-pairing-ai" component={MealPairingAI} />
        <Route path="/weaning-off-tool" component={WeaningOffTool} />
        <Route path="/wine-pairing" component={WinePairing} />
        {/* Lifestyle Hub (formerly Emotion AI) */}
        <Route path="/lifestyle" component={LifestyleLandingPage} />
        <Route path="/emotion-ai" component={LifestyleLandingPage} />
        {/* DELETED: /meal-finder route (old MealFinder moved to _quarantine - use /social-hub/find instead) */}
        {/* Founders Route */}
        <Route path="/founders" component={FoundersPage} />
        {/* Supplement Hub Routes */}
        {/* REMOVED: /supplement-hub-landing route (landing page not used - Copilot routes to /supplement-hub directly) */}
        <Route path="/supplement-hub" component={SupplementHub} />
        <Route
          path="/supplement-education"
          component={SupplementEducationPage}
        />
        {/* 404 fallback */}
        <Route component={NotFound} />
      </Switch>
      {shouldShowBottomNav && <BottomNav />}
    </>
  );
}
