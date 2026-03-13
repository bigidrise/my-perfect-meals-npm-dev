import { ReactNode } from "react";
import { useLocation } from "wouter";
import DesktopLayout from "./DesktopLayout";
import MobileLayout from "./MobileLayout";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/contexts/AuthContext";
import { Monitor, ArrowLeft } from "lucide-react";

const FULL_SCREEN_ROUTES = [
  "/welcome",
  "/auth",
  "/onboarding",
  "/onboarding-v2",
  "/onboarding-legacy",
  "/forgot-password",
  "/reset-password",
  "/guest-builder",
  "/guest-suite",
  "/guest",
  "/procare-welcome",
  "/procare-identity",
  "/procare-attestation",
  "/consumer-welcome",
  "/checkout/success",
  "/affiliates",
];

const UNAUTHENTICATED_FULL_SCREEN_ROUTES: string[] = [];

const STUDIO_ROUTE_PREFIXES = ["/pro/", "/care-team", "/pro-portal"];

function shouldUseDesktopLayout(): boolean {
  const host = window.location.hostname;
  if (host === "app.myperfectmeals.com") return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".replit.dev")) return true;
  if (host.endsWith(".replit.app")) return true;
  return false;
}

function isStudioRoute(path: string): boolean {
  return STUDIO_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isProfessional(user: any): boolean {
  return (
    user?.professionalRole === "trainer" ||
    user?.professionalRole === "physician"
  );
}

function DesktopRequiredScreen() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center">
        <Monitor className="w-8 h-8 text-blue-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">
        Studio requires a desktop
      </h1>
      <p className="text-white/60 max-w-sm text-base leading-relaxed">
        The ProCare Studio is designed for desktop and tablet use. Please open
        My Perfect Meals on a larger screen to access coaching tools.
      </p>
      <p className="mt-6 text-white/30 text-sm">
        Your clients can still use the mobile app normally.
      </p>
      <button
        onClick={() => navigate("/dashboard")}
        className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white/80 text-sm font-medium active:bg-white/20"
      >
        <ArrowLeft className="w-4 h-4" />
        Go back
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isDesktop = useIsDesktop();
  const desktopDomain = shouldUseDesktopLayout();
  const { isAuthenticated, user } = useAuth();

  const isFullScreen = FULL_SCREEN_ROUTES.some(
    (r) => location === r || location.startsWith(r + "/")
  );

  const isUnauthFullScreen =
    !isAuthenticated &&
    UNAUTHENTICATED_FULL_SCREEN_ROUTES.some(
      (r) => location === r || location.startsWith(r + "/")
    );

  if (
    !isDesktop &&
    isProfessional(user) &&
    isStudioRoute(location)
  ) {
    return <DesktopRequiredScreen />;
  }

  if (!isDesktop || isFullScreen || isUnauthFullScreen || !desktopDomain) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return <DesktopLayout>{children}</DesktopLayout>;
}
