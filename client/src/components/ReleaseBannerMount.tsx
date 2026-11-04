import { useLocation } from "wouter";
import { useUpdateState } from "@/contexts/UpdateContext";
import { UpdateBanner } from "@/components/UpdateBanner";

// Account entry/setup only. Ordinary tools, pricing and guest features retain
// their existing release/refresh behavior.
const ACCOUNT_ENTRY_PATHS = [
  "/auth", "/login", "/signup", "/logout", "/signout",
  "/welcome", "/forgot-password", "/reset-password",
  "/onboarding", "/onboarding-v2", "/select-builder",
  "/consumer-welcome", "/procare-welcome", "/trainer-welcome", "/physician-welcome",
  "/procare-identity", "/procare-attestation", "/professional-onboarding-bridge",
  "/pilot/activate", "/activate/business-pilot",
  "/join", "/business/start", "/business/setup",
];

export function suppressReleaseBanner(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  return ACCOUNT_ENTRY_PATHS.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function ReleaseBannerMount() {
  const [location] = useLocation();
  const { hasUpdate, releaseNotes, releaseId } = useUpdateState();
  if (suppressReleaseBanner(location)) return null;
  return <UpdateBanner show={hasUpdate} releaseNotes={releaseNotes} releaseId={releaseId} />;
}
