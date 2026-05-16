import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { applyOrgTheme } from "@/lib/applyOrgTheme";

export type OrgFeatureFlags = {
  whiteLabelMode: boolean;
  customBranding: boolean;
  physicianDashboard: boolean;
  providerMessaging: boolean;
  medicalRecordIntegration: boolean;
  diabeticHub: boolean;
  glp1Support: boolean;
  partnerMarketplace: boolean;
  productRecommendations: boolean;
  oncologySupport: boolean;
  coachTools: boolean;
  biometricTracking: boolean;
};

export type OrgConfig = {
  id: string;
  slug: string;
  name: string;
  activeStatus: string;
  organizationType: string;
  dataAccessMode: string;
  appName: string;
  appShortName: string;
  supportEmail: string;
  supportUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  onboardingHeadline: string | null;
  poweredByVisible: boolean;
  customDomain: string | null;
  featureFlags: OrgFeatureFlags;
  isDefault: boolean;
  isWhiteLabel: boolean;
};

export const DEFAULT_ORG_CONFIG: OrgConfig = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  slug: "mpm-public",
  name: "My Perfect Meals",
  activeStatus: "active",
  organizationType: "public",
  dataAccessMode: "standalone",
  appName: "My Perfect Meals",
  appShortName: "MPM",
  supportEmail: "support@myperfectmeals.com",
  supportUrl: null,
  primaryColor: "#f97316",
  secondaryColor: "#ea580c",
  accentColor: null,
  logoUrl: null,
  logoDarkUrl: null,
  onboardingHeadline: null,
  poweredByVisible: true,
  customDomain: null,
  featureFlags: {
    whiteLabelMode: false,
    customBranding: false,
    physicianDashboard: false,
    providerMessaging: false,
    medicalRecordIntegration: false,
    diabeticHub: true,
    glp1Support: true,
    partnerMarketplace: false,
    productRecommendations: false,
    oncologySupport: false,
    coachTools: true,
    biometricTracking: true,
  },
  isDefault: true,
  isWhiteLabel: false,
};

type OrgContextValue = {
  org: OrgConfig;
  isLoading: boolean;
  hasFlag: (flag: keyof OrgFeatureFlags) => boolean;
};

const OrgContext = createContext<OrgContextValue>({
  org: DEFAULT_ORG_CONFIG,
  isLoading: true,
  hasFlag: () => false,
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<OrgConfig>(DEFAULT_ORG_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/org/config")
      .then((r) => {
        if (!r.ok) throw new Error(`org/config returned ${r.status}`);
        return r.json();
      })
      .then((data: OrgConfig) => {
        setOrg(data);
        applyOrgTheme(data);
        if (data.appName) {
          document.title = data.appName;
        }
      })
      .catch(() => {
        // Silent fallback — MPM defaults remain active
      })
      .finally(() => setIsLoading(false));
  }, []);

  const hasFlag = useCallback(
    (flag: keyof OrgFeatureFlags) => org.featureFlags[flag] === true,
    [org]
  );

  return (
    <OrgContext.Provider value={{ org, isLoading, hasFlag }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}

export function useOrgFlag(flag: keyof OrgFeatureFlags): boolean {
  const { hasFlag } = useContext(OrgContext);
  return hasFlag(flag);
}
