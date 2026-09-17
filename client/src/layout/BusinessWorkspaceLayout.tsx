import type { ReactNode } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import BusinessDesktopLayout from "./BusinessDesktopLayout";

function supportsDesktopLayout(): boolean {
  const host = window.location.hostname;
  return (
    host === "app.myperfectmeals.com" ||
    host === "app.myperfectmeals.ai" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".replit.dev") ||
    host.endsWith(".replit.app")
  );
}

export default function BusinessWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (!isDesktop || !supportsDesktopLayout()) {
    return <>{children}</>;
  }

  return <BusinessDesktopLayout>{children}</BusinessDesktopLayout>;
}