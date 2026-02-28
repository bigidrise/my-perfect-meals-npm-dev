import React, { lazy, useEffect, useRef } from "react";
import { Switch, Route, useLocation } from "wouter";
import GeneralNutritionBuilder from "@/pages/pro/GeneralNutritionBuilder";
import ScrollRestorer from "@/components/ScrollRestorer";
import BottomNav from "@/components/BottomNav";
import { withPageErrorBoundary } from "@/components/PageErrorBoundary";
import { withGate } from "@/components/GatedRoute";
import ABTestingDemo from "@/pages/ABTestingDemo";
import { FEATURES } from "@/utils/features";
import ComingSoon from "@/pages/ComingSoon";
import StudioBottomNav from "@/components/pro/StudioBottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Plan Builder Pages
// DELETED: PlanBuilderTurbo, PlanBuilderHub, CompetitionBeachbodyBoard
import Planner from "@/pages/Planner";
import WeeklyMealBoard from "@/pages/WeeklyMealBoard";
import BeachBodyMealBoard from "@/pages/BeachBodyMealBoard";
import MacroCounter from "@/pages/MacroCalculator";
// DELETED: AdultBeverageHubPage, HealthyKidsMeals, KidsMealsHub, ToddlersMealsHub
import LifestyleLandingPage from "@/pages/LifestyleLandingPage"; // Renamed from EmotionAIHub
import GLP1MealsTracking from "@/pages/GLP1MealsTracking";

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
// Onboarding V3 - 5-page safety-first flow
import OnboardingV3 from "@/pages/OnboardingV3";
import OnboardingStandalone from "@/pages/onboarding-standalone";
import ExtendedOnboarding from "@/pages/onboarding/ExtendedOnboarding";
import Welcome from "@/pages/Welcome";
import GuestBuilder from "@/pages/GuestBuilder";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PricingPage from "@/pages/PricingPage";
import ApplyGuidance from "@/pages/ApplyGuidance";
import MealBuilderSelection from "@/pages/MealBuilderSelection";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import FamilyInfoPage from "@/pages/FamilyInfoPage";
import AdminModerationPage from "@/pages/admin-moderation";
import ConsumerWelcome from "@/pages/ConsumerWelcome";
import ProCareWelcome from "@/pages/procare/ProCareWelcome";
import ProCareIdentity from "@/pages/procare/ProCareIdentity";
import ProCareAttestation from "@/pages/procare/ProCareAttestation";
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
import PhysicianCareTeam from "@/pages/care-team/PhysicianCareTeam";
import TrainerCareTeam from "@/pages/care-team/TrainerCareTeam";
import PhysicianPortal from "@/pages/pro/PhysicianPortal";
import MorePage from "@/pages/More";
import ProPortal from "@/pages/ProPortal";
import ProClients from "@/pages/pro/ProClients";
import ProClientsPhysician from "@/pages/pro/ProClientsPhysician";
import ProClientDashboard from "@/pages/pro/ProClientDashboard";
import TrainerClientDashboard from "@/pages/pro/TrainerClientDashboard";
import ClinicianClientDashboard from "@/pages/pro/ClinicianClientDashboard";
import ProBoardViewer from "@/pages/pro/ProBoardViewer";
import WorkspaceShell from "@/pages/pro/WorkspaceShell";
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
import ChefsKitchenPage from "@/pages/lifestyle/ChefsKitchenPage";
import CravingCreatorLanding from "@/pages/CravingCreatorLanding";
import CravingDessertCreator from "@/pages/CravingDessertCreator";
// DELETED: CravingPresets
import CravingStudio from "@/pages/craving-creator/CravingStudio";
import DessertStudio from "@/pages/dessert-creator/DessertStudio";
import FridgeRescueStudio from "@/pages/fridge-rescue/FridgeRescueStudio";
import EditProfilePage from "@/pages/profile/EditProfilePage";
import SavedMeals from "@/pages/SavedMeals";

// DELETED: AlcoholHubLanding, AlcoholLeanAndSocial, AlcoholSmartSips, MocktailsLowCalMixers, AlcoholLog
import BeerPairing from "@/pages/beer-pairing";
import BourbonSpirits from "@/pages/bourbon-spirits";
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

const SafeOnboarding = withPageErrorBoundary(OnboardingV3, "Onboarding");
const SafeOnboardingV2 = withPageErrorBoundary(OnboardingV3, "Onboarding V2");
const SafeOnboardingLegacy = withPageErrorBoundary(OnboardingStandalone, "Onboarding");
const SafeDashboard = withPageErrorBoundary(DashboardNew, "Dashboard");
const SafeMacroCounter = withPageErrorBoundary(MacroCounter, "Macro Counter");
const SafeMyBiometrics = withPageErrorBoundary(MyBiometrics, "My Biometrics");
const SafeBiometrics = withPageErrorBoundary(MyBiometrics, "Biometrics");
const SafeBodyComposition = withPageErrorBoundary(BodyComposition, "Body Composition");
const SafeSleep = withPageErrorBoundary(Sleep, "Sleep Tracking");
const SafeWeeklyMealBoard = withPageErrorBoundary(WeeklyMealBoard, "Weekly Meal Board");
const SafePlanner = withPageErrorBoundary(Planner, "Planner");
const SafeShoppingList = withPageErrorBoundary(ShoppingListMasterView, "Shopping List");
const SafeMore = withPageErrorBoundary(MorePage, "More");
const SafeCareTeam = withPageErrorBoundary(CareTeam, "Care Team");
const SafePhysicianCareTeam = withPageErrorBoundary(PhysicianCareTeam, "Physician Care Team");
const SafeTrainerCareTeam = withPageErrorBoundary(TrainerCareTeam, "Trainer Care Team");
const SafeProPortal = withPageErrorBoundary(ProPortal, "Pro Portal");
const SafeProClients = withPageErrorBoundary(ProClients, "Pro Clients");
const SafeProClientsPhysician = withPageErrorBoundary(ProClientsPhysician, "Physician Clients");
const SafeProClientDashboard = withPageErrorBoundary(ProClientDashboard, "Client Dashboard");
const SafeTrainerClientDashboard = withPageErrorBoundary(TrainerClientDashboard, "Trainer Dashboard");
const SafeClinicianClientDashboard = withPageErrorBoundary(ClinicianClientDashboard, "Clinician Dashboard");
const SafeProBoardViewer = withPageErrorBoundary(ProBoardViewer, "Pro Board Viewer");
const SafeWorkspaceShell = withPageErrorBoundary(WorkspaceShell, "Client Workspace");
const SafeDiabeticHub = withPageErrorBoundary(DiabeticHub, "Diabetic Hub");
const SafeDiabetesSupport = withPageErrorBoundary(DiabetesSupportPage, "Diabetes Support");
const SafeDiabeticMenuBuilder = withPageErrorBoundary(DiabeticMenuBuilder, "Diabetic Menu Builder");
const SafeGLP1Hub = withPageErrorBoundary(GLP1Hub, "GLP-1 Hub");
const SafeGLP1MealBuilder = withPageErrorBoundary(GLP1MealBuilder, "GLP-1 Meal Builder");
const SafeAntiInflammatoryMenuBuilder = withPageErrorBoundary(AntiInflammatoryMenuBuilder, "Anti-Inflammatory Menu Builder");

export default function Router() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const guardRedirectedRef = useRef(false);

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
    "/guest-suite",
    "/forgot-password",
    "/reset-password",
    "/onboarding",
    "/onboarding-v2",
    "/onboarding-legacy",
    "/pricing",
    "/checkout/success",
    "/consumer-welcome",
    "/procare-welcome",
    "/procare-identity",
    "/procare-attestation",
  ];

  const shouldShowBottomNav = !hideBottomNavRoutes.includes(location);

  const { user } = useAuth();

  const isClinicianUser =
    user?.role === "coach" ||
    user?.role === "trainer" ||
    user?.role === "physician";

  const clinicWorkspaceRoutes = [
    "/care-team",
    "/pro-portal",
    "/pro/clients",
    "/pro/physician-clients",
    "/pro/physician",
  ];

  const isInPersonalBuilder =
    location === "/pro/general-nutrition-builder" ||
    location === "/performance-competition-builder";

  const isInClinicWorkspace = clinicWorkspaceRoutes.some(route =>
    location.startsWith(route)
  );

  const showClinicianNav = isClinicianUser && isInClinicWorkspace && !isInPersonalBuilder;

  // Routes that DON'T require onboarding or macro completion
  const ungatedRoutes = [
    "/", "/auth", "/welcome", "/login", "/signup",
    "/guest-builder", "/guest-suite",
    "/forgot-password", "/reset-password",
    "/onboarding", "/onboarding-v2", "/onboarding-legacy", "/onboarding/extended",
    "/pricing", "/paywall", "/apply-guidance",
    "/checkout/success",
    "/consumer-welcome", "/procare-welcome", "/procare-identity", "/procare-attestation",
    "/privacy", "/privacy-policy", "/terms",
    "/profile", "/settings",
    "/home",
  ];

  const isUngatedRoute = ungatedRoutes.some(r => location === r || location.startsWith(r + "/"));
  const isMacroRoute = location === "/macro-counter" || location.startsWith("/macro-counter");

  // Onboarding + Macro route guards with toast feedback
  useEffect(() => {
    if (!user || isUngatedRoute || isMacroRoute) return;
    if (user.id.startsWith("guest-") || user.isTester) return;
    if (guardRedirectedRef.current) return;

    // Guard 1: Onboarding must be complete
    if (!user.onboardingCompletedAt) {
      guardRedirectedRef.current = true;
      toast({
        title: "Almost there!",
        description: "Let's finish setting up your safety profile first.",
      });
      setLocation("/onboarding");
      setTimeout(() => { guardRedirectedRef.current = false; }, 1000);
      return;
    }

    // Guard 2: Macro profile must be complete (age, height, weight required)
    const hasMacroProfile = user.age && user.height && user.weight;
    const hasLocalMacroSettings = (() => {
      try {
        const s = localStorage.getItem("macro_calculator_settings");
        if (!s) return false;
        const p = JSON.parse(s);
        return p.age && (p.heightFt || p.heightCm) && (p.weightLbs || p.weightKg);
      } catch { return false; }
    })();
    if (!hasMacroProfile && !hasLocalMacroSettings) {
      guardRedirectedRef.current = true;
      toast({
        title: "One more step",
        description: "We need your macro profile to generate accurate meals.",
      });
      setLocation("/macro-counter?from=onboarding");
      setTimeout(() => { guardRedirectedRef.current = false; }, 1000);
      return;
    }
  }, [location, user]);

  return (
    <>
      <ScrollRestorer />
      <Switch>
        {/* Core Routes */}
        <Route path="/welcome" component={Welcome} />
        <Route path="/guest-builder" component={GuestBuilder} />
        <Route path="/guest-suite" component={GuestBuilder} />
        <Route path="/home" component={Home} />
        <Route path="/auth" component={Auth} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/apply-guidance" component={ApplyGuidance} />
        <Route path="/paywall" component={PricingPage} />
        <Route path="/select-builder" component={MealBuilderSelection} />
        <Route path="/onboarding/extended" component={ExtendedOnboarding} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/family-info" component={FamilyInfoPage} />
        <Route path="/admin-moderation" component={AdminModerationPage} />
        <Route path="/consumer-welcome" component={ConsumerWelcome} />
        <Route path="/procare-welcome" component={ProCareWelcome} />
        <Route path="/procare-identity" component={ProCareIdentity} />
        <Route path="/procare-attestation" component={ProCareAttestation} />
        {/* DELETED: CommunityTestPage, CommunityPage routes */}
        <Route path="/onboarding" component={SafeOnboarding} />
        <Route path="/onboarding-v2" component={SafeOnboardingV2} />
        <Route path="/onboarding-legacy" component={SafeOnboardingLegacy} />
        <Route path="/dashboard" component={SafeDashboard} />
        <Route path="/tutorials" component={TutorialHub} />
        <Route path="/learn" component={Learn} />
        <Route path="/get-inspiration" component={GetInspiration} />
        <Route path="/privacy" component={PrivacySecurity} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        {/* Profile Edit Page */}
        <Route path="/profile" component={EditProfilePage} />
        <Route path="/saved-meals" component={SavedMeals} />
        {/* DELETED: AffiliatesPage, FoundersPage, FoundersSubmit, Changelog routes */}
        {/* DELETED: MealPlanning, LowGlycemicCarbPage, AiMealCreatorPage, MealPlanningHubRevised routes */}
        <Route path="/lifestyle" component={LifestyleLandingPage} />
        {/* DELETED: /healthy-kids-meals, /kids-meals, /toddler-meals routes (Phase 1 cleanup) */}
        <Route path="/glp1-meals-tracking" component={GLP1MealsTracking} />
        <Route path="/lifestyle/chefs-kitchen" component={withGate(ChefsKitchenPage, 'chefsKitchen')} />
        <Route path="/craving-creator" component={CravingCreator} />
        <Route path="/fridge-rescue" component={FridgeRescuePage} />
        <Route path="/ab-testing-demo" component={ABTestingDemo} />
        {/* DELETED: HolidayFeastPlannerPage, MealFinderPage, BreakfastMealsHub, LunchMealsHub, DinnerMealsHub, SnacksMealsHub, CulturalCuisinesPage, VegetableFiberInfo, PotluckPlanner, RestaurantGuide (old) routes */}
        {/* Socializing Hub Routes */}
        <Route path="/social-hub" component={SocializingHub} />
        <Route path="/social-hub/find" component={SocialFindMeals} />
        <Route path="/social-hub/restaurant-guide" component={SocialRestaurantGuide} />
        {/* DELETED: SmartWeekBuilder, AdultBeverageHubPage routes */}
        <Route path="/macro-counter" component={SafeMacroCounter} />
        {/* DELETED: All kids meal routes, all alcohol hub routes */}
        <Route path="/my-biometrics" component={SafeMyBiometrics} />
        {/* Biometric sub-pages */}
        <Route path="/biometrics" component={SafeBiometrics} />
        <Route path="/biometrics/body-composition" component={SafeBodyComposition} />
        <Route path="/biometrics/sleep" component={SafeSleep} />
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
        <Route path="/weekly" component={SafeWeeklyMealBoard} />
        {/* DELETED: PlanBuilderTurbo, ProteinPlannerPage, PlanBuilderHub, CompetitionBeachbodyBoard routes */}
        <Route path="/planner" component={SafePlanner} />
        <Route path="/weekly-meal-board" component={SafeWeeklyMealBoard} />
        <Route path="/beach-body-meal-board" component={BeachBodyMealBoard} />
        {/* Legacy redirects - redirect Classic Builder to Weekly Meal Board */}
        <Route path="/plan-builder/classic" component={SafeWeeklyMealBoard} />
        <Route path="/builder/classic" component={SafeWeeklyMealBoard} />
        {/* DELETED: PlanBuilderTurbo route */}
        {/* DELETED: CravingHub, CravingPresetsPage, SearchPage, PhysicianReportView, SmartMenuBuilder routes */}
        {/* DELETED: GLP1Hub, GLP1MealBuilder, SpecialtyDietsHub, HormonePresetDetail, HormonePreviewWeeklyBoard, ToughDayCompanion, DiabetesSupport routes */}
        {/* Health Support Routes */}
        {/* Meal Log History Route */}
        {/* <Route path="/meal-log-history" component={MealLogHistoryPage} /> */}{" "}
        {/* TEMPORARILY DISABLED - File missing */}
        {/* Shopping List Routes */}
        <Route path="/shopping-list-v2" component={SafeShoppingList} />
        <Route path="/shopping-list" component={SafeShoppingList} />
        {/* ProCare Feature Routes (ProCare Cover → Care Team → Pro Portal → Client Dashboard → Performance & Competition Builder) */}
        <Route path="/more" component={SafeMore} />
        <Route path="/pro/physician" component={PhysicianPortal} />
        <Route path="/care-team" component={SafeCareTeam} />
        <Route path="/care-team/physician" component={SafePhysicianCareTeam} />
        <Route path="/care-team/trainer" component={SafeTrainerCareTeam} />
        <Route path="/pro-portal" component={SafeProPortal} />
        <Route path="/pro/clients" component={SafeProClients} />
        <Route path="/pro/physician-clients" component={SafeProClientsPhysician} />
        <Route path="/pro/workspace/:clientId" component={SafeWorkspaceShell} />
        <Route path="/pro/clients/:id" component={SafeProClientDashboard} />
        <Route path="/pro/clients/:id/trainer" component={SafeTrainerClientDashboard} />
        <Route path="/pro/clients/:id/clinician" component={SafeClinicianClientDashboard} />
        <Route path="/pro/clients/:clientId/board/:program" component={SafeProBoardViewer} />
        <Route path="/pro-client-dashboard" component={SafeProClientDashboard} />
        <Route
          path="/performance-competition-builder"
          component={PerformanceCompetitionBuilderStandalone}
        />
        <Route
          path="/pro/general-nutrition-builder"
          component={GeneralNutritionBuilder}
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
        <Route
          path="/pro/clients/:id/weekly-builder"
          component={SafeWeeklyMealBoard}
        />
        <Route
          path="/pro/clients/:id/beach-body-builder"
          component={BeachBodyMealBoard}
        />
        {/* Physician Hub Routes (Diabetic, GLP-1, Medical Diets, Clinical Lifestyle) */}
        <Route path="/diabetic-hub" component={SafeDiabeticHub} />
        <Route path="/diabetes-support" component={SafeDiabetesSupport} />
        <Route path="/diabetic-menu-builder" component={SafeDiabeticMenuBuilder} />
        <Route path="/glp1-hub" component={SafeGLP1Hub} />
        <Route path="/glp1-meal-builder" component={SafeGLP1MealBuilder} />
        {/* QUARANTINED: /medical-diets-hub route removed - MedicalDietsHub moved to _quarantine */}
        <Route path="/anti-inflammatory-menu-builder" component={SafeAntiInflammatoryMenuBuilder} />
        {/* Craving Creator Routes */}
        <Route
          path="/craving-creator-landing"
          component={CravingCreatorLanding}
        />
        {/* DELETED: /craving-hub route (old CravingHub moved to _quarantine - use /craving-creator-landing instead) */}
        <Route path="/craving-desserts" component={CravingDessertCreator} />
        <Route path="/craving-studio" component={withGate(CravingStudio, 'studioCreators')} />
        <Route path="/dessert-studio" component={withGate(DessertStudio, 'studioCreators')} />
        <Route path="/fridge-rescue-studio" component={FridgeRescueStudio} />
        {/* DELETED: /craving-presets, /alcohol-hub, /alcohol/lean-and-social, /alcohol-smart-sips, /mocktails-low-cal-mixers, /alcohol-log (Phase 1 cleanup) */}
        <Route path="/beer-pairing" component={BeerPairing} />
        <Route path="/bourbon-spirits" component={BourbonSpirits} />
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
      {shouldShowBottomNav && !showClinicianNav && <BottomNav />}
      {showClinicianNav && <StudioBottomNav />}
    </>
  );
}


