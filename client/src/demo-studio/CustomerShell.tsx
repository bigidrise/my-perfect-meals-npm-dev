import { useLocation } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import CustomerAccessLayout from "@/components/AppRouter";
import DesktopLayout from "@/layout/DesktopLayout";
import BottomNav from "@/components/BottomNav";
import {
  SafeOnboarding, SafeDashboard, SafeMacroCounter, GuardedBuilders,
  GuardedMealBuilderSelection, LifestyleLandingPage, SafeMore,
  GuardedCravingCreatorLanding, GuardedBeverageCreatorHub,
} from "@/components/Router";
import { assertIsolatedDemoRuntime } from "./runtimeAuthority";

// No normal Router/Switch is mounted. Only approved pages can be selected.
// These are the same components/guards used by the normal route definitions.
const pages = {
  "/dashboard": SafeDashboard, "/onboarding": SafeOnboarding,
  "/onboarding-v2": SafeOnboarding, "/macro-counter": SafeMacroCounter,
  "/builders": GuardedBuilders, "/select-builder": GuardedMealBuilderSelection,
  "/lifestyle": LifestyleLandingPage, "/more": SafeMore,
  "/craving-creator-landing": GuardedCravingCreatorLanding,
  "/lifestyle/beverage-hub": GuardedBeverageCreatorHub,
};

export default function CustomerShell() {
  assertIsolatedDemoRuntime();
  const [path] = useLocation();
  const desktop = useIsDesktop();
  const Page = pages[path as keyof typeof pages];
  if (!Page) return <p role="alert">This destination has not been verified for Demo Mode.</p>;
  const fullScreen = path.startsWith("/onboarding");
  // The ordinary authentication/onboarding/layout boundary is preserved too.
  const content = <CustomerAccessLayout><Page /></CustomerAccessLayout>;
  // The opaque demo.invalid host deliberately isn't an application domain.
  // Reuse the actual desktop chrome explicitly, without changing AppLayout's
  // real-domain rule or pretending the frame is the live application host.
  return desktop && !fullScreen ? <DesktopLayout>{content}</DesktopLayout>
    : <>{content}{!fullScreen && <BottomNav />}</>;
}
