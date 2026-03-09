import { ReactNode } from "react";
import { useLocation } from "wouter";
import DesktopLayout from "./DesktopLayout";
import MobileLayout from "./MobileLayout";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/contexts/AuthContext";

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

function shouldUseDesktopLayout(): boolean {
  const host = window.location.hostname;
  if (host === "app.myperfectmeals.com") return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".replit.dev")) return true;
  return false;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isDesktop = useIsDesktop();
  const desktopDomain = shouldUseDesktopLayout();
  const { isAuthenticated } = useAuth();

  const isFullScreen = FULL_SCREEN_ROUTES.some(
    (r) => location === r || location.startsWith(r + "/")
  );

  const isUnauthFullScreen = !isAuthenticated && UNAUTHENTICATED_FULL_SCREEN_ROUTES.some(
    (r) => location === r || location.startsWith(r + "/")
  );

  if (!isDesktop || isFullScreen || isUnauthFullScreen || !desktopDomain) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return <DesktopLayout>{children}</DesktopLayout>;
}
