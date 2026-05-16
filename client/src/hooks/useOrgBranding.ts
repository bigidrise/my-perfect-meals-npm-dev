import { useOrg } from "@/contexts/OrgContext";

export function useOrgBranding() {
  const { org } = useOrg();
  return {
    appName: org.appName ?? "My Perfect Meals",
    appShortName: org.appShortName ?? "MPM",
    supportEmail: org.supportEmail ?? "support@myperfectmeals.com",
    supportUrl: org.supportUrl ?? `mailto:${org.supportEmail ?? "support@myperfectmeals.com"}`,
    poweredByText: org.poweredByVisible ? "Powered by My Perfect Meals Intelligence" : null,
    onboardingHeadline: org.onboardingHeadline ?? null,
    isWhiteLabel: org.isWhiteLabel,
    isDefault: org.isDefault,
  };
}
