import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import DesktopLayout from "./DesktopLayout";
import MobileLayout from "./MobileLayout";

const FULL_SCREEN_ROUTES = [
  "/welcome",
  "/auth",
  "/onboarding",
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

function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    typeof window !== "undefined" && window.innerWidth >= 1024
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return desktop;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isDesktop = useIsDesktop();

  const isFullScreen = FULL_SCREEN_ROUTES.some(
    (r) => location === r || location.startsWith(r + "/")
  );

  if (!isDesktop || isFullScreen) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return <DesktopLayout>{children}</DesktopLayout>;
}
