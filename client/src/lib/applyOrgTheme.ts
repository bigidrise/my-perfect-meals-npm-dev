import type { OrgConfig } from "@/contexts/OrgContext";

export function applyOrgTheme(org: OrgConfig): void {
  const root = document.documentElement;

  if (org.featureFlags.customBranding && org.primaryColor) {
    root.style.setProperty("--org-primary", org.primaryColor);
    root.style.setProperty("--org-secondary", org.secondaryColor ?? org.primaryColor);
    root.style.setProperty("--org-accent", org.accentColor ?? org.primaryColor);
  } else {
    root.style.removeProperty("--org-primary");
    root.style.removeProperty("--org-secondary");
    root.style.removeProperty("--org-accent");
  }
}
