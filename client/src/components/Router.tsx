import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { BUILDER_MAP, type BuilderKey } from "@/lib/builderMap";
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
import { hasActivePaidSubscription, isProOrAbove, isClinicalOrAbove } from "@/lib/subscriptionCheck";
import { apiRequest } from "@/lib/queryClient";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";

const COACHING_ADMIN_USER_ID = "6796ce88-dff8-4336-adcb-e53986830f3f";

function getFeatureNameFromPath(path: string): string {
  const map: Record<string, string> = {
    "/saved-meals": "Saved Meals",
    "/shopping-list-v2": "Shopping List",
    "/craving-creator": "Craving Creator",
    "/dessert-creator": "Dessert Creator",
    "/beverages": "Beverage Creator",
    "/sushi-creator": "Sushi Creator",
    "/social-hub": "Restaurant Guide",
    "/companion": "My Perfect Pets",
    "/companion/dogs": "My Perfect Pets — Dogs",
    "/gatherings": "My Perfect Gatherings",
    "/pairings": "Chef Pairings",
    "/pairings-hub": "Chef Pairings Hub",
    "/wine-list-helper": "Wine & Spirits Hub",
    "/reduce-drinking": "Mindful Drinking Plan",
    "/fast-food-guide": "Fast Food Guide",
    "/restaurant-finder": "Find Meals Near Me",
  };
  for (const [prefix, name] of Object.entries(map)) {
    if (path === prefix || path.startsWith(prefix + "/")) return name;
  }
  return undefined as unknown as string;
}

function CoachingAdminGate({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  if (!user) return null;
  if (user.id !== COACHING_ADMIN_USER_ID) {
    setLocation("/");
    return null;
  }
  return <Component />;
}

function AdminGuard({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  if (!user) return null;
  if (!(user as any).isAdmin) {
    setLocation("/");
    return null;
  }
  return <Component />;
}


function BuilderAccessGuard({ builderKey, component: Component }: { builderKey: BuilderKey; component: React.ComponentType }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { requestUpgrade } = useUpgradeModal();
  const isBlocked = !!user && !hasActivePaidSubscription(user);

  useEffect(() => {
    if (isBlocked) {
      requestUpgrade({ requiredTier: "essential", featureName: getFeatureNameFromPath(location) });
    }
  }, [isBlocked, location]);

  if (!user || isBlocked) return null;
  if (user.id === COACHING_ADMIN_USER_ID || (user as any).builderSwitchUnlimited) return <Component />;
  const active = user.activeBoard as BuilderKey | null | undefined;
  if (!active) {
    return <Component />;
  }
  if (active !== builderKey) {
    const correctRoute = BUILDER_MAP[active]?.clientRoute;
    setLocation(correctRoute || "/select-builder");
    return null;
  }
  return <Component />;
}

function PaywallGuard({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const { requestUpgrade } = useUpgradeModal();
  const isBlocked = !!user && !hasActivePaidSubscription(user);

  useEffect(() => {
    if (isBlocked) {
      requestUpgrade({ requiredTier: "essential", featureName: getFeatureNameFromPath(location) });
    }
  }, [isBlocked, location]);

  if (!user || isBlocked) return null;
  return <Component />;
}

function ProGuard({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const { requestUpgrade } = useUpgradeModal();
  const isBlocked = !!user && !isProOrAbove(user);

  useEffect(() => {
    if (isBlocked) {
      requestUpgrade({ requiredTier: "pro", featureName: getFeatureNameFromPath(location) });
    }
  }, [isBlocked, location]);

  if (!user || isBlocked) return null;
  return <Component />;
}

function ClinicalGuard({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const { requestUpgrade } = useUpgradeModal();
  const isBlocked = !!user && !isClinicalOrAbove(user);

  useEffect(() => {
    if (isBlocked) {
      requestUpgrade({ requiredTier: "clinical", featureName: getFeatureNameFromPath(location) });
    }
  }, [isBlocked, location]);

  if (!user || isBlocked) return null;
  return <Component />;
}

const PROCARE_CERT_POLL_MS = 5 * 60 * 1000; // 5 minutes

function ProCareStudioGuard({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [certChecked, setCertChecked] = useState(false);
  const [certified, setCertified] = useState(false);
  const certifiedRef = useRef(false);

  const verifyCert = useCallback(
    (isInitial: boolean) => {
      if (!user) return;
      if (!user.professionalRole) {
        setCertified(true);
        certifiedRef.current = true;
        if (isInitial) setCertChecked(true);
        return;
      }
      apiRequest("/api/certifications/platform/progress")
        .then((res: any) => {
          const phase1Complete =
            res?.certification?.status === "completed" && !!res?.certification?.completedAt;
          if (!phase1Complete) {
            setCertified(false);
            certifiedRef.current = false;
            // Route directly into the certification flow, not the launchpad
            setLocation("/professional-onboarding-bridge");
          } else if (user?.phase2GateEnabled && !user?.procareTrainingCompleted) {
            setCertified(false);
            certifiedRef.current = false;
            // Phase 1 done, Phase 2 required — go directly into Phase 2
            setLocation("/procare-training");
          } else {
            setCertified(true);
            certifiedRef.current = true;
          }
          if (isInitial) setCertChecked(true);
        })
        .catch(() => {
          if (isInitial) {
            setCertified(false);
            certifiedRef.current = false;
            setLocation("/professional-onboarding-bridge");
            setCertChecked(true);
          }
          // On polling errors, keep current state — don't kick out on transient failures
        });
    },
    [user?.id, user?.procareTrainingCompleted, user?.phase2GateEnabled]
  );

  // Initial check on mount / user change
  useEffect(() => {
    setCertChecked(false);
    setCertified(false);
    certifiedRef.current = false;
    verifyCert(true);
  }, [user?.id]);

  // Periodic re-verification while the page stays open
  useEffect(() => {
    if (!user?.professionalRole) return;
    const intervalId = setInterval(() => {
      verifyCert(false);
    }, PROCARE_CERT_POLL_MS);
    return () => clearInterval(intervalId);
  }, [user?.id, verifyCert]);

  if (!certChecked) return null;
  if (!certified) return null;
  return <Component />;
}

// Plan Builder Pages
// DELETED: PlanBuilderTurbo, PlanBuilderHub, CompetitionBeachbodyBoard
import Builders from "@/pages/Builders";
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
import PrivacySecurity from "@/pages/privacy";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import DeleteAccount from "@/pages/DeleteAccount";
// Onboarding V3 - active onboarding (OnboardingV3 is the ONLY onboarding — do not reference onboarding-standalone.tsx)
import OnboardingV3 from "@/pages/OnboardingV3";
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
import HouseholdProfilesPage from "@/pages/HouseholdProfilesPage";
import ProCareInfoPage from "@/pages/ProCareInfoPage";
import PersonalGuidanceInfoPage from "@/pages/PersonalGuidanceInfoPage";
import AdminModerationPage from "@/pages/admin-moderation";
import ChefKitchensAdmin from "@/pages/admin/ChefKitchensAdmin";
import SignatureKitchenPage from "@/pages/kitchen/SignatureKitchenPage";
import SignatureKitchenHubPage from "@/pages/kitchen/SignatureKitchenHubPage";
import ConsumerWelcome from "@/pages/ConsumerWelcome";
import ProCareWelcome from "@/pages/procare/ProCareWelcome";
import ProCareIdentity from "@/pages/procare/ProCareIdentity";
import ProCareAttestation from "@/pages/procare/ProCareAttestation";
import ProCareRewards from "@/pages/procare/ProCareRewards";
import ProLaunchpad from "@/pages/procare/ProLaunchpad";
import ProCareTraining from "@/pages/procare/ProCareTraining";
import ProfessionalOnboardingBridge from "@/pages/procare/ProfessionalOnboardingBridge";
import CertifiedProfessionalUnlock from "@/pages/procare/CertifiedProfessionalUnlock";
// DELETED: CommunityTestPage, CommunityPage (no page component exists)

// Additional component imports
// DELETED: MealPlanningHubRevised (comprehensive-meal-planning-revised)
import CravingCreator from "@/pages/craving-creator";
import FridgeRescuePage from "@/pages/fridge-rescue";
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
import TipsStrategiesPage from "@/pages/TipsStrategiesPage";
import ProPortal from "@/pages/ProPortal";
import ProClients from "@/pages/pro/ProClients";
import ProClientsPhysician from "@/pages/pro/ProClientsPhysician";
import ProClientDashboard from "@/pages/pro/ProClientDashboard";
import TrainerClientDashboard from "@/pages/pro/TrainerClientDashboard";
import ClinicianClientDashboard from "@/pages/pro/ClinicianClientDashboard";
import ProClientNutritionPlan from "@/pages/ProClientNutritionPlan";
import ProBoardViewer from "@/pages/pro/ProBoardViewer";
import WorkspaceShell from "@/pages/pro/WorkspaceShell";
import PerformanceCompetitionBuilder from "@/pages/pro/PerformanceCompetitionBuilder";

// Physician Hub Pages
import DiabeticHub from "@/pages/physician/DiabeticHub";
import DiabetesSupportPage from "@/pages/physician/DiabetesSupportPage";
import DiabeticMenuBuilder from "@/pages/physician/DiabeticMenuBuilder";
import GLP1Hub from "@/pages/physician/GLP1Hub";
import GLP1MealBuilder from "@/pages/physician/GLP1MealBuilder";
import AntiInflammatoryMenuBuilder from "@/pages/physician/AntiInflammatoryMenuBuilder";

// Creator Studio pages
import CreatorStartPage from "@/pages/creator/CreatorStartPage";
import CreatorSetupPage from "@/pages/creator/CreatorSetupPage";
import CreatorStudioPage from "@/pages/creator/CreatorStudioPage";
import CreatorStudioLanding from "@/pages/creator/CreatorStudioLanding";

// Craving pages
import ChefsKitchenPage from "@/pages/lifestyle/ChefsKitchenPage";
import CreateDishPage from "@/pages/lifestyle/CreateDishPage";
import GatheringsPage from "@/pages/lifestyle/GatheringsPage";
import MyPerfectGetaway from "@/pages/lifestyle/MyPerfectGetaway";
import MyPerfectPregnancyPage from "@/pages/MyPerfectPregnancyPage";
import PerformanceNutritionHub from "@/pages/PerformanceNutritionHub";
import PerformanceNutritionSetupPage from "@/pages/PerformanceNutritionSetupPage";
import CravingCreatorLanding from "@/pages/CravingCreatorLanding";
import SushiCreator from "@/pages/SushiCreator";
import BeverageCreatorHub from "@/pages/BeverageCreatorHub";
import AthleteBeverageCreator from "@/pages/AthleteBeverageCreator";
import CravingDessertCreator from "@/pages/CravingDessertCreator";
import BeverageCreator from "@/pages/BeverageCreator";
import ChefPairings from "@/pages/ChefPairings";
import PairingsHub from "@/pages/lifestyle/PairingsHub";
import PairingsAI from "@/pages/lifestyle/PairingsAI";
import WineListHelper from "@/pages/lifestyle/WineListHelper";
import ReduceDrinkingPlan from "@/pages/lifestyle/ReduceDrinkingPlan";
// DELETED: CravingPresets
// RETIRED: CravingStudio, DessertStudio, FridgeRescueStudio — moved to client/src/legacy/studio-retired/
import EditProfilePage from "@/pages/profile/EditProfilePage";
import CoachingPreferencesPage from "@/pages/profile/CoachingPreferencesPage";
import SavedMeals from "@/pages/SavedMeals";

// DELETED: AlcoholHubLanding, AlcoholLeanAndSocial, AlcoholSmartSips, MocktailsLowCalMixers, AlcoholLog
// DELETED: BeerPairing, BourbonSpirits, MealPairingAI, WinePairing (replaced by /lifestyle/pairings-ai)
import WeaningOffTool from "@/pages/weaning-off-tool";

// Socializing Hub pages
import SocializingHub from "@/pages/SocializingHub";
import SocialFindMeals from "@/pages/SocialFindMeals";
import SocialRestaurantGuide from "@/pages/SocialRestaurantGuide";
import FastFoodGuidePage from "@/pages/FastFoodGuidePage";
import RestaurantFinderPage from "@/pages/RestaurantFinderPage";

// Founders page
import FoundersPage from "@/pages/Founders";
import CoachesComingSoon from "@/pages/CoachesComingSoon";
import BusinessCenter from "@/pages/BusinessCenter";
import BusinessCenterSection from "@/pages/BusinessCenterSection";
import AcademyLandingPage from "@/pages/AcademyLandingPage";
import PartnerProgramsHub from "@/pages/PartnerProgramsHub";
import FoundingPartnerProgram from "@/pages/FoundingPartnerProgram";
import IndustryPartnerships from "@/pages/IndustryPartnerships";
import WhiteLabelSolutions from "@/pages/WhiteLabelSolutions";
import PublicPartnersHub from "@/pages/PublicPartnersHub";
import PublicHealthcarePartnerships from "@/pages/PublicHealthcarePartnerships";
import AffiliateOpportunities from "@/pages/AffiliateOpportunities";
import AffiliatePathPage from "@/pages/AffiliatePathPage";
import AffiliateProgramOverview from "@/pages/AffiliateProgramOverview";
import AffiliateDashboard from "@/pages/AffiliateDashboard";
import CertificationDashboard from "@/pages/certification/CertificationDashboard";
import CertificationLesson from "@/pages/certification/CertificationLesson";
import CertificationQuiz from "@/pages/certification/CertificationQuiz";
import CertificationComplete from "@/pages/certification/CertificationComplete";
import CertificationCertificateView from "@/pages/certification/CertificationCertificateView";
import AcademyHome from "@/pages/academy/AcademyHome";
import PlatformMasteryDashboard from "@/pages/academy/PlatformMasteryDashboard";
import LessonReader from "@/pages/academy/LessonReader";
import LearningHub from "@/pages/learning/LearningHub";
import PlatformCertDashboard from "@/pages/learning/PlatformCertDashboard";
import PlatformCertVideo from "@/pages/learning/PlatformCertVideo";
import PlatformCertQuiz from "@/pages/learning/PlatformCertQuiz";
import PlatformCertComplete from "@/pages/learning/PlatformCertComplete";
import UpdatesInbox from "@/pages/learning/UpdatesInbox";
import AdminCertifications from "@/pages/admin/AdminCertifications";

// SimpleWalkthroughDemo quarantined - replaced by Quick Tour system

// DELETED: AffiliatesPage

// Vitals Logger - Creating a placeholder for this route
const VitalsLogger = () => <div>Vitals Logger - Coming Soon</div>;

// Supplement Hub imports
// REMOVED: SupplementHubLanding (landing page not used - Copilot now routes to /supplement-hub directly)
import SupplementHub from "@/pages/supplement-hub";
import SupplementEducationPage from "@/pages/supplement-education";

// Companion Nutrition Intelligence (My Perfect Pets)
import PetsHub from "@/pages/PetsHub";
import CompanionNutritionHub from "@/pages/CompanionNutritionHub";
import DogProfileSetup from "@/pages/companion/DogProfileSetup";
import CompanionMealGenerator from "@/pages/companion/CompanionMealGenerator";
import DogIngredientScanner from "@/pages/companion/DogIngredientScanner";
import CatNutritionHub from "@/pages/companion/CatNutritionHub";
import CatProfileSetup from "@/pages/companion/CatProfileSetup";

// Admin Dashboard
import AdminDashboard from "@/pages/AdminDashboard";

// Wrapper components for Performance Competition Builder boards
const PerformanceCompetitionBuilderStandalone = (_props: any) => (
  <PerformanceCompetitionBuilder mode="athlete" />
);
const PerformanceCompetitionBuilderProCare = (_props: any) => (
  <PerformanceCompetitionBuilder mode="procare" />
);

const SafeOnboarding = withPageErrorBoundary(OnboardingV3, "Onboarding");
const SafeOnboardingV2 = withPageErrorBoundary(OnboardingV3, "Onboarding V2");
const SafeDashboard = withPageErrorBoundary(DashboardNew, "Dashboard");
const SafeMacroCounter = withPageErrorBoundary(MacroCounter, "Macro Counter");
const SafeMyBiometrics = withPageErrorBoundary(MyBiometrics, "My Biometrics");
const SafeBiometrics = withPageErrorBoundary(MyBiometrics, "Biometrics");
const SafeBodyComposition = withPageErrorBoundary(BodyComposition, "Body Composition");
const SafeSleep = withPageErrorBoundary(Sleep, "Sleep Tracking");
const SafeWeeklyMealBoard = withPageErrorBoundary(WeeklyMealBoard, "Weekly Meal Board");
const SafeBuilders = withPageErrorBoundary(Builders, "Builders");
const SafeShoppingList = withPageErrorBoundary(ShoppingListMasterView, "Shopping List");
const SafeMore = withPageErrorBoundary(MorePage, "More");
const SafeTips = withPageErrorBoundary(TipsStrategiesPage, "Tips");
const SafeCareTeam = withPageErrorBoundary(CareTeam, "Care Team");
const SafePhysicianCareTeam = withPageErrorBoundary(PhysicianCareTeam, "Physician Care Team");
const SafeTrainerCareTeam = withPageErrorBoundary(TrainerCareTeam, "Trainer Care Team");
const SafeProPortal = withPageErrorBoundary(ProPortal, "Pro Portal");
const SafeProClients = withPageErrorBoundary(ProClients, "Pro Clients");
const SafeProClientsPhysician = withPageErrorBoundary(ProClientsPhysician, "Physician Clients");
const SafeProClientDashboard = withPageErrorBoundary(ProClientDashboard, "Client Dashboard");
const SafeTrainerClientDashboard = withPageErrorBoundary(TrainerClientDashboard, "Trainer Dashboard");
const SafeClinicianClientDashboard = withPageErrorBoundary(ClinicianClientDashboard, "Clinician Dashboard");
const SafeProClientNutritionPlan = withPageErrorBoundary(ProClientNutritionPlan, "Client Nutrition Life Plan");
const SafeProBoardViewer = withPageErrorBoundary(ProBoardViewer, "Pro Board Viewer");
const SafeWorkspaceShell = withPageErrorBoundary(WorkspaceShell, "Client Workspace");
const SafeDiabeticHub = withPageErrorBoundary(DiabeticHub, "Diabetic Hub");
const SafeDiabetesSupport = withPageErrorBoundary(DiabetesSupportPage, "Diabetes Support");
const SafeDiabeticMenuBuilder = withPageErrorBoundary(DiabeticMenuBuilder, "Diabetic Menu Builder");
const SafeGLP1Hub = withPageErrorBoundary(GLP1Hub, "Metabolic Medication Hub");
const SafeGLP1MealBuilder = withPageErrorBoundary(GLP1MealBuilder, "Metabolic Medication Builder");
const SafeAntiInflammatoryMenuBuilder = withPageErrorBoundary(AntiInflammatoryMenuBuilder, "Anti-Inflammatory Menu Builder");

const GuardedProPortal = () => <ProCareStudioGuard component={SafeProPortal} />;
const GuardedProClients = () => <ProCareStudioGuard component={SafeProClients} />;
const GuardedProClientsPhysician = () => <ProCareStudioGuard component={SafeProClientsPhysician} />;
const GuardedWorkspaceShell = () => <ProCareStudioGuard component={SafeWorkspaceShell} />;
const GuardedProClientDashboard = () => <ProCareStudioGuard component={SafeProClientDashboard} />;
const GuardedProClientNutritionPlan = () => <ProCareStudioGuard component={SafeProClientNutritionPlan} />;
const GuardedTrainerClientDashboard = () => <ProCareStudioGuard component={SafeTrainerClientDashboard} />;
const GuardedClinicianClientDashboard = () => <ProCareStudioGuard component={SafeClinicianClientDashboard} />;
const GuardedProBoardViewer = () => <ProCareStudioGuard component={SafeProBoardViewer} />;
const GuardedWeeklyMealBoard = () => <BuilderAccessGuard builderKey="weekly" component={SafeWeeklyMealBoard} />;
const GuardedShoppingList = () => <PaywallGuard component={SafeShoppingList} />;
const GuardedBeachBodyBuilder = () => <BuilderAccessGuard builderKey="beach_body" component={BeachBodyMealBoard} />;
const GuardedAntiInflammatoryBuilder = () => <BuilderAccessGuard builderKey="anti_inflammatory" component={SafeAntiInflammatoryMenuBuilder} />;
const GuardedGeneralNutritionBuilder = () => <BuilderAccessGuard builderKey="general_nutrition" component={GeneralNutritionBuilder} />;
const GuardedPerformanceBuilder = () => <BuilderAccessGuard builderKey="performance_competition" component={PerformanceCompetitionBuilderStandalone} />;
const GuardedDiabeticBuilder = () => <BuilderAccessGuard builderKey="diabetic" component={SafeDiabeticMenuBuilder} />;
const GuardedGLP1Builder = () => <BuilderAccessGuard builderKey="glp1" component={SafeGLP1MealBuilder} />;
const GuardedSavedMeals = () => <PaywallGuard component={SavedMeals} />;
const GuardedCravingCreator = () => <ProGuard component={CravingCreator} />;
const GuardedCravingCreatorLanding = () => <ProGuard component={CravingCreatorLanding} />;
const GuardedCravingDesserts = () => <ProGuard component={CravingDessertCreator} />;
const GuardedBeverageCreator = () => <ProGuard component={BeverageCreator} />;
const GuardedBeverageCreatorHub = () => <ProGuard component={BeverageCreatorHub} />;
const GuardedSushiCreator = () => <ProGuard component={SushiCreator} />;
const GuardedGatheringsPage = () => <ProGuard component={GatheringsPage} />;
const GuardedGetaway = () => <ClinicalGuard component={MyPerfectGetaway} />;
const GuardedChefPairings = () => <ProGuard component={ChefPairings} />;
const GuardedPairingsHub = () => <ProGuard component={PairingsHub} />;
const GuardedPairingsAI = () => <ProGuard component={PairingsAI} />;
const GuardedWineListHelper = () => <ProGuard component={WineListHelper} />;
const GuardedReduceDrinkingPlan = () => <ProGuard component={ReduceDrinkingPlan} />;
const GuardedPetsHub = () => <ProGuard component={PetsHub} />;
const GuardedCompanionHub = () => <ProGuard component={CompanionNutritionHub} />;
const GuardedDogProfileSetup = () => <ProGuard component={DogProfileSetup} />;
const GuardedCompanionMealGenerator = () => <ProGuard component={CompanionMealGenerator} />;
const GuardedDogIngredientScanner = () => <ProGuard component={DogIngredientScanner} />;
const GuardedCatNutritionHub = () => <ProGuard component={CatNutritionHub} />;
const GuardedCatProfileSetup = () => <ProGuard component={CatProfileSetup} />;
const GuardedSocializingHub = () => <ProGuard component={SocializingHub} />;
const GuardedSocialFindMeals = () => <ProGuard component={SocialFindMeals} />;
const GuardedSocialRestaurantGuide = () => <ProGuard component={SocialRestaurantGuide} />;
const GuardedFastFoodGuidePage = () => <ProGuard component={FastFoodGuidePage} />;
const GuardedRestaurantFinderPage = () => <ProGuard component={RestaurantFinderPage} />;

export default function Router() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const guardRedirectedRef = useRef(false);
  const isDesktopView = useIsDesktop();

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
    "/pricing",
    "/checkout/success",
    "/consumer-welcome",
    "/procare-welcome",
    "/procare-identity",
    "/procare-rewards",
    "/procare-attestation",
    "/pro-launchpad",
    "/professional-dashboard",
    "/professional-onboarding-bridge",
    "/procare-certified",
    "/procare-training",
    "/procare-info",
    "/family-info",
    "/personal-guidance-info",
    "/performance/setup",
    "/coach-corner/welcome",
    "/coach-corner/intake",
    "/coach-corner/complete",
    "/coach-corner/home",
    "/coach-corner/progress-slowed",
    "/coach-corner/tired",
  ];

  const shouldShowBottomNav = !hideBottomNavRoutes.includes(location);

  const { user } = useAuth();

  const isClinicianUser =
    user?.role === "coach" ||
    user?.role === "trainer" ||
    user?.role === "physician" ||
    user?.professionalRole === "trainer" ||
    user?.professionalRole === "physician";

  const isInPersonalBuilder =
    location === "/pro/general-nutrition-builder" ||
    location === "/performance-competition-builder";

  const isInClinicWorkspace =
    location.startsWith("/care-team") ||
    location.startsWith("/pro-portal") ||
    location.startsWith("/pro/");

  const showClinicianNav = isClinicianUser && isInClinicWorkspace && !isInPersonalBuilder;

  // Routes that DON'T require onboarding or macro completion
  const ungatedRoutes = [
    "/", "/auth", "/welcome", "/login", "/signup",
    "/guest-builder", "/guest-suite",
    "/forgot-password", "/reset-password",
    "/onboarding", "/onboarding-v2", "/onboarding/extended",
    "/pricing", "/paywall", "/apply-guidance",
    "/checkout/success",
    "/consumer-welcome", "/procare-welcome", "/procare-identity", "/procare-rewards", "/procare-attestation", "/pro-launchpad", "/professional-dashboard", "/professional-onboarding-bridge", "/procare-certified", "/procare-training",
    "/trainer-welcome", "/physician-welcome",
    "/procare-info", "/family-info", "/personal-guidance-info",
    "/privacy", "/privacy-policy", "/terms", "/delete-account",
    "/partners",
    "/profile", "/settings",
    "/home",
    "/business/join",
  ];

  const isUngatedRoute = ungatedRoutes.some(r => location === r || location.startsWith(r + "/"));
  const isMacroRoute = location === "/macro-counter" || location.startsWith("/macro-counter");

  const isProfessionalUser =
    user?.professionalRole === "trainer" || user?.professionalRole === "physician";

  // Onboarding + Macro route guards with toast feedback
  useEffect(() => {
    if (!user || isUngatedRoute || isMacroRoute) return;
    if (user.id.startsWith("guest-") || user.isTester) return;
    if (guardRedirectedRef.current) return;

    // Professionals (trainers, physicians) are never subject to consumer guards.
    // They have their own onboarding path and do not need a macro profile to use the app.
    if (isProfessionalUser) return;

    // Guard 0: Purchase-required mode — set when user arrives via /pricing?required=true
    // Keeps the user on the pricing page until they have an active paid subscription.
    const purchaseRequired = localStorage.getItem("mpm_purchase_required") === "true";
    if (purchaseRequired) {
      if (hasActivePaidSubscription(user)) {
        localStorage.removeItem("mpm_purchase_required");
      } else {
        guardRedirectedRef.current = true;
        setLocation("/pricing?required=true");
        setTimeout(() => { guardRedirectedRef.current = false; }, 1000);
        return;
      }
    }

    // Guard 1: Onboarding must be complete (only for paid consumers)
    if (hasActivePaidSubscription(user) && !user.onboardingCompletedAt) {
      guardRedirectedRef.current = true;
      toast({
        title: "Almost there!",
        description: "Let's finish setting up your safety profile first.",
      });
      setLocation("/onboarding");
      setTimeout(() => { guardRedirectedRef.current = false; }, 1000);
      return;
    }

    // Guard 2: Macro profile must be complete (age, height, weight required — consumers only)
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
  }, [location, user, isProfessionalUser]);

  return (
    <>
      <ScrollRestorer />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-black text-white/60 text-sm">
            Loading...
          </div>
        }
      >
      <Switch>
        {/* Root route — AppRouter handles redirect to /welcome, /onboarding, or /dashboard */}
        <Route path="/">{() => null}</Route>
        {/* Core Routes */}
        <Route path="/welcome" component={Welcome} />
        <Route path="/guest-builder" component={GuestBuilder} />
        <Route path="/guest-suite" component={GuestBuilder} />
        <Route path="/home" component={Home} />
        <Route path="/auth" component={Auth} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/apply-guidance" component={() => <CoachingAdminGate component={ApplyGuidance} />} />
        <Route path="/paywall" component={PricingPage} />
        <Route path="/select-builder" component={MealBuilderSelection} />
        <Route path="/onboarding/extended" component={ExtendedOnboarding} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/billing/success" component={CheckoutSuccess} />
        <Route path="/business/dashboard" component={lazy(() => import("@/pages/BusinessDashboard"))} />
        <Route path="/business/join/:token" component={lazy(() => import("@/pages/BusinessInviteAccept"))} />
        <Route path="/family-info" component={FamilyInfoPage} />
        <Route path="/household-profiles" component={HouseholdProfilesPage} />
        <Route path="/procare-info" component={ProCareInfoPage} />
        <Route path="/personal-guidance-info" component={PersonalGuidanceInfoPage} />
        <Route path="/admin-moderation" component={AdminModerationPage} />
        <Route path="/admin/chef-kitchens" component={ChefKitchensAdmin} />
        <Route path="/kitchens" component={SignatureKitchenHubPage} />
        <Route path="/kitchen/:slug" component={SignatureKitchenPage} />
        <Route path="/consumer-welcome" component={ConsumerWelcome} />
        <Route path="/procare-welcome" component={ProCareWelcome} />
        <Route path="/trainer-welcome" component={ProCareWelcome} />
        <Route path="/physician-welcome" component={ProCareWelcome} />
        <Route path="/procare-identity" component={ProCareIdentity} />
        <Route path="/procare-rewards" component={ProCareRewards} />
        <Route path="/procare-attestation" component={ProCareAttestation} />
        <Route path="/pro-launchpad" component={ProLaunchpad} />
        <Route path="/professional-dashboard" component={ProLaunchpad} />
        <Route path="/professional-onboarding-bridge" component={ProfessionalOnboardingBridge} />
        <Route path="/procare-certified" component={CertifiedProfessionalUnlock} />
        <Route path="/procare-training" component={ProCareTraining} />
        <Route path="/ace-profile" component={lazy(() => import("@/pages/AceProfilePage"))} />
        <Route path="/coach-corner/welcome" component={lazy(() => import("@/pages/CoachCornerWelcome"))} />
        <Route path="/coach-corner/intake" component={lazy(() => import("@/pages/CoachCornerIntake"))} />
        <Route path="/coach-corner/complete" component={lazy(() => import("@/pages/CoachCornerComplete"))} />
        <Route path="/coach-corner/home" component={lazy(() => import("@/pages/CoachCornerHome"))} />
        <Route path="/coach-corner/progress-slowed" component={lazy(() => import("@/pages/CoachCornerProgressSlowed"))} />
        <Route path="/coach-corner/tired" component={lazy(() => import("@/pages/CoachCornerTired"))} />
        {/* DELETED: CommunityTestPage, CommunityPage routes */}
        <Route path="/onboarding" component={SafeOnboarding} />
        <Route path="/onboarding-v2" component={SafeOnboardingV2} />
        <Route path="/dashboard" component={SafeDashboard} />
        <Route path="/tutorials" component={TutorialHub} />
        <Route path="/learn" component={Learn} />
        <Route path="/get-inspiration" component={GetInspiration} />
        <Route path="/privacy" component={PrivacySecurity} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />
        <Route path="/delete-account" component={DeleteAccount} />
        {/* Profile Edit Page */}
        <Route path="/profile" component={EditProfilePage} />
        <Route path="/coaching-preferences" component={CoachingPreferencesPage} />
        <Route path="/saved-meals" component={GuardedSavedMeals} />
        {/* DELETED: AffiliatesPage, FoundersPage, FoundersSubmit, Changelog routes */}
        {/* DELETED: MealPlanning, LowGlycemicCarbPage, AiMealCreatorPage, MealPlanningHubRevised routes */}
        <Route path="/lifestyle" component={LifestyleLandingPage} />
        {/* Creator Studio — all routes open to all users */}
        <Route path="/creator-studio" component={CreatorStudioLanding} />
        <Route path="/creator/start" component={CreatorStartPage} />
        <Route path="/creator/setup" component={CreatorSetupPage} />
        <Route path="/creator/studio" component={CreatorStudioPage} />
        {/* DELETED: /healthy-kids-meals, /kids-meals, /toddler-meals routes (Phase 1 cleanup) */}
        <Route path="/glp1-meals-tracking" component={GLP1MealsTracking} />
        <Route path="/lifestyle/my-perfect-pregnancy" component={MyPerfectPregnancyPage} />
        <Route path="/performance" component={PerformanceNutritionHub} />
        <Route path="/performance/setup" component={PerformanceNutritionSetupPage} />
        <Route path="/lifestyle/my-perfect-getaway" component={GuardedGetaway} />
        <Route path="/lifestyle/my-perfect-gatherings" component={GuardedGatheringsPage} />
        <Route path="/lifestyle/ultimate-experiences" component={GuardedGatheringsPage} />
        <Route path="/lifestyle/chefs-kitchen" component={withGate(ChefsKitchenPage, 'chefsKitchen')} />
        <Route path="/lifestyle/create-a-dish" component={withGate(CreateDishPage, 'chefsKitchen')} />
        <Route path="/lifestyle/beverage-creator" component={GuardedBeverageCreator} />
        <Route path="/lifestyle/beverage-hub" component={GuardedBeverageCreatorHub} />
        <Route path="/lifestyle/athlete-beverage-creator" component={AthleteBeverageCreator} />
        <Route path="/lifestyle/sushi-creator" component={GuardedSushiCreator} />
        <Route path="/sushi-creator" component={GuardedSushiCreator} />
        <Route path="/lifestyle/chef-pairings" component={GuardedChefPairings} />
        <Route path="/lifestyle/pairings-hub" component={GuardedPairingsHub} />
        <Route path="/lifestyle/pairings-ai" component={GuardedPairingsAI} />
        <Route path="/lifestyle/wine-list-helper" component={GuardedWineListHelper} />
        <Route path="/lifestyle/reduce-drinking-plan" component={GuardedReduceDrinkingPlan} />
        <Route path="/craving-creator" component={GuardedCravingCreator} />
        <Route path="/fridge-rescue" component={FridgeRescuePage} />
        {/* Companion Nutrition Intelligence (My Perfect Pets) — Pro+ */}
        <Route path="/companion" component={GuardedPetsHub} />
        <Route path="/companion/dogs" component={GuardedCompanionHub} />
        <Route path="/companion/setup" component={GuardedDogProfileSetup} />
        <Route path="/companion/setup/:id" component={GuardedDogProfileSetup} />
        <Route path="/companion/generator" component={GuardedCompanionMealGenerator} />
        <Route path="/companion/scanner" component={GuardedDogIngredientScanner} />
        <Route path="/companion/cats" component={GuardedCatNutritionHub} />
        <Route path="/companion/cat-setup" component={GuardedCatProfileSetup} />
        <Route path="/companion/cat-setup/:id" component={GuardedCatProfileSetup} />
        <Route path="/companion/cat-generator" component={GuardedCompanionMealGenerator} />
        <Route path="/ab-testing-demo" component={ABTestingDemo} />
        {/* DELETED: HolidayFeastPlannerPage, MealFinderPage, BreakfastMealsHub, LunchMealsHub, DinnerMealsHub, SnacksMealsHub, CulturalCuisinesPage, VegetableFiberInfo, PotluckPlanner, RestaurantGuide (old) routes */}
        {/* Socializing Hub Routes — Pro+ */}
        <Route path="/social-hub" component={GuardedSocializingHub} />
        <Route path="/social-hub/find" component={GuardedSocialFindMeals} />
        <Route path="/social-hub/restaurant-guide" component={GuardedSocialRestaurantGuide} />
        <Route path="/social-hub/fast-food" component={GuardedFastFoodGuidePage} />
        <Route path="/social-hub/restaurant-finder" component={GuardedRestaurantFinderPage} />
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
        <Route path="/weekly" component={GuardedWeeklyMealBoard} />
        {/* DELETED: PlanBuilderTurbo, ProteinPlannerPage, PlanBuilderHub, CompetitionBeachbodyBoard routes */}
        <Route path="/builders" component={SafeBuilders} />
        <Route path="/planner">{() => { window.location.replace("/builders"); return null; }}</Route>
        <Route path="/weekly-meal-board" component={GuardedWeeklyMealBoard} />
        <Route path="/beach-body-meal-board" component={GuardedBeachBodyBuilder} />
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
        <Route path="/shopping-list-v2" component={GuardedShoppingList} />
        <Route path="/shopping-list" component={GuardedShoppingList} />
        {/* ProCare Feature Routes (ProCare Cover → Care Team → Pro Portal → Client Dashboard → Performance & Competition Builder) */}
        <Route path="/more" component={SafeMore} />
        <Route path="/tips" component={SafeTips} />
        <Route path="/pro/physician" component={PhysicianPortal} />
        <Route path="/care-team" component={SafeCareTeam} />
        <Route path="/care-team/physician" component={SafePhysicianCareTeam} />
        <Route path="/care-team/trainer" component={SafeTrainerCareTeam} />
        <Route path="/pro-portal" component={GuardedProPortal} />
        <Route path="/pro" component={() => { const [, go] = useLocation(); useEffect(() => { go("/pro-portal"); }, []); return null; }} />
        <Route path="/pro/clients" component={GuardedProClients} />
        <Route path="/pro/physician-clients" component={GuardedProClientsPhysician} />
        <Route path="/pro/workspace/:clientId" component={GuardedWorkspaceShell} />
        <Route path="/pro/clients/:id" component={GuardedProClientDashboard} />
        <Route path="/pro/clients/:id/nutrition-life-plan" component={GuardedProClientNutritionPlan} />
        <Route path="/pro/clients/:id/trainer" component={GuardedTrainerClientDashboard} />
        <Route path="/pro/clients/:id/clinician" component={GuardedClinicianClientDashboard} />
        <Route path="/pro/clients/:clientId/board/:program" component={GuardedProBoardViewer} />
        <Route path="/pro-client-dashboard" component={GuardedProClientDashboard} />
        <Route
          path="/performance-competition-builder"
          component={GuardedPerformanceBuilder}
        />
        <Route
          path="/pro/general-nutrition-builder"
          component={GuardedGeneralNutritionBuilder}
        />
        <Route
          path="/pro/performance-competition-builder"
          component={GuardedPerformanceBuilder}
        />
        <Route path="/pro/clients/:id/general-nutrition-builder" component={() => <ProCareStudioGuard component={GeneralNutritionBuilder} />} />
        <Route path="/pro/clients/:id/performance-competition-builder" component={() => <ProCareStudioGuard component={PerformanceCompetitionBuilderProCare} />} />
        <Route path="/pro/clients/:id/diabetic-builder" component={() => <ProCareStudioGuard component={SafeDiabeticMenuBuilder} />} />
        <Route path="/pro/clients/:id/glp1-builder" component={() => <ProCareStudioGuard component={SafeGLP1MealBuilder} />} />
        <Route path="/pro/clients/:id/anti-inflammatory-builder" component={() => <ProCareStudioGuard component={SafeAntiInflammatoryMenuBuilder} />} />
        <Route path="/pro/clients/:id/kidney-disease-builder" component={() => <ProCareStudioGuard component={SafeAntiInflammatoryMenuBuilder} />} />
        <Route path="/pro/clients/:id/heart-failure-builder" component={() => <ProCareStudioGuard component={SafeAntiInflammatoryMenuBuilder} />} />
        <Route path="/pro/clients/:id/liver-disease-builder" component={() => <ProCareStudioGuard component={SafeAntiInflammatoryMenuBuilder} />} />
        <Route path="/pro/clients/:id/weekly-builder" component={() => <ProCareStudioGuard component={SafeWeeklyMealBoard} />} />
        <Route path="/pro/clients/:id/beach-body-builder" component={() => <ProCareStudioGuard component={BeachBodyMealBoard} />} />
        {/* Physician Hub Routes (Diabetic, GLP-1, Medical Diets, Clinical Lifestyle) */}
        <Route path="/diabetic-hub" component={SafeDiabeticHub} />
        <Route path="/diabetes-support" component={SafeDiabetesSupport} />
        <Route path="/diabetic-menu-builder" component={GuardedDiabeticBuilder} />
        <Route path="/glp1-hub" component={SafeGLP1Hub} />
        <Route path="/glp1-meal-builder" component={GuardedGLP1Builder} />
        <Route path="/anti-inflammatory-menu-builder" component={GuardedAntiInflammatoryBuilder} />
        {/* Craving Creator Routes */}
        <Route
          path="/craving-creator-landing"
          component={GuardedCravingCreatorLanding}
        />
        <Route path="/craving-desserts" component={GuardedCravingDesserts} />
        {/* RETIRED: /craving-studio, /dessert-studio, /fridge-rescue-studio — Studio features decommissioned */}
        {/* DELETED: /craving-presets, /alcohol-hub, /alcohol/lean-and-social, /alcohol-smart-sips, /mocktails-low-cal-mixers, /alcohol-log (Phase 1 cleanup) */}
        {/* DELETED: /beer-pairing, /bourbon-spirits, /meal-pairing-ai, /wine-pairing (replaced by /lifestyle/pairings-ai) */}
        <Route path="/weaning-off-tool" component={WeaningOffTool} />
        <Route path="/emotion-ai" component={LifestyleLandingPage} />
        {/* Founders Route */}
        <Route path="/founders" component={FoundersPage} />
        <Route path="/coaches" component={CoachesComingSoon} />
        {/* Business Center */}
        <Route path="/business-center" component={BusinessCenter} />
        {/* LMS / Learning & Certification System */}
        <Route path="/learning" component={LearningHub} />
        <Route path="/certifications/updates" component={UpdatesInbox} />
        <Route path="/certifications/:certType/complete" component={PlatformCertComplete} />
        <Route path="/certifications/:certType/video/:slug" component={PlatformCertVideo} />
        <Route path="/certifications/:certType/quiz/:slug" component={PlatformCertQuiz} />
        <Route path="/certifications/:certType" component={PlatformCertDashboard} />
        {/* Admin */}
        <Route path="/admin/certifications" component={() => <AdminGuard component={AdminCertifications} />} />
        {/* Affiliate Program — overview gates path selection */}
        <Route path="/business-center/affiliate/dashboard" component={AffiliateDashboard} />
        <Route path="/business-center/affiliate" component={AffiliateProgramOverview} />
        <Route path="/business-center/affiliate/choose" component={AffiliateOpportunities} />
        <Route path="/business-center/affiliate/social" component={AffiliatePathPage} />
        <Route path="/business-center/affiliate/coaching" component={AffiliatePathPage} />
        <Route path="/business-center/affiliate/:pathId/certification/complete" component={CertificationComplete} />
        <Route path="/business-center/affiliate/:pathId/certification/view" component={CertificationCertificateView} />
        <Route path="/business-center/affiliate/:pathId/certification/:moduleId/quiz" component={CertificationQuiz} />
        <Route path="/business-center/affiliate/:pathId/certification/:moduleId" component={CertificationLesson} />
        <Route path="/business-center/affiliate/:pathId/certification" component={CertificationDashboard} />
        <Route path="/business-center/partners" component={PartnerProgramsHub} />
        <Route path="/business-center/founding-partner" component={FoundingPartnerProgram} />
        <Route path="/business-center/academy" component={AcademyLandingPage} />
        <Route path="/academy" component={AcademyHome} />
        <Route path="/academy/platform-mastery/lesson/:lessonId" component={LessonReader} />
        <Route path="/academy/platform-mastery" component={PlatformMasteryDashboard} />
        <Route path="/business-center/industry" component={IndustryPartnerships} />
        <Route path="/business-center/healthcare" component={PublicHealthcarePartnerships} />
        <Route path="/business-center/white-label" component={WhiteLabelSolutions} />
        <Route path="/business-center/partnerships" component={BusinessCenterSection} />
        {/* Public partner pages — no login required */}
        <Route path="/partners" component={PublicPartnersHub} />
        <Route path="/partners/founding" component={FoundingPartnerProgram} />
        <Route path="/partners/industry" component={IndustryPartnerships} />
        <Route path="/partners/healthcare" component={PublicHealthcarePartnerships} />
        <Route path="/partners/white-label" component={WhiteLabelSolutions} />
        {/* Supplement Hub Routes */}
        {/* REMOVED: /supplement-hub-landing route (landing page not used - Copilot routes to /supplement-hub directly) */}
        <Route path="/supplement-hub" component={SupplementHub} />
        <Route
          path="/supplement-education"
          component={SupplementEducationPage}
        />
        {/* Admin Dashboard — role-checked on both server and client */}
        <Route path="/admin" component={AdminDashboard} />
        {/* 404 fallback */}
        <Route component={NotFound} />
      </Switch>
      </Suspense>
      {!isDesktopView && shouldShowBottomNav && !showClinicianNav && <BottomNav />}
      {!isDesktopView && showClinicianNav && <StudioBottomNav />}
    </>
  );
}


