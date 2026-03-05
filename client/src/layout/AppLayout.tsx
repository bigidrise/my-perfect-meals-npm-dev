import { ReactNode } from "react";
import { useLocation } from "wouter";
import DesktopLayout from "./DesktopLayout";
import MobileLayout from "./MobileLayout";
import { useIsDesktop } from "@/hooks/useIsDesktop";

const FULL_SCREEN_ROUTES = [
  "/welcome",
  "/auth",
  "/onboarding",
  "/onboarding-v2",
  "/onboarding-legacy",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/paywall",
  "/guest-builder",
  "/guest-suite",
  "/guest",
  "/procare-welcome",
  "/procare-identity",
  "/procare-attestation",
  "/consumer-welcome",
  "/checkout/success",
  "/privacy",
  "/affiliates",
  "/founders",
];

const DESKTOP_DOMAINS = [
  "app.myperfectmeals.com",
];

function isDesktopDomain(): boolean {
  const host = window.location.hostname;
  if (DESKTOP_DOMAINS.includes(host)) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".replit.dev") || host.endsWith(".replit.app")) return true;
  return false;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isDesktop = useIsDesktop();

  const isFullScreen = FULL_SCREEN_ROUTES.some(
    (r) => location === r || location.startsWith(r + "/")
  );

  if (!isDesktop || isFullScreen || !isDesktopDomain()) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return <DesktopLayout>{children}</DesktopLayout>;
}
