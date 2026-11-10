import { useEffect, useState } from "react";
import OrganizationPaidSuccessPrompt from "./OrganizationPaidSuccessPrompt";

interface Props {
  userId: string;
  organizationId: string;
  /** Server-resolved paid evidence, never inferred from Stripe return parameters. */
  paidActivationVerified: boolean;
  affiliate: { organizationId: string; canManage: boolean; hasLinkedRewardful: boolean } | null;
  onOpenPartnerRevenue: () => void;
}

export default function OrganizationPaidOnboarding(props: Props) {
  const { userId, organizationId, paidActivationVerified, affiliate, onOpenPartnerRevenue } = props;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const key = `organization-paid-onboarding:v1:${userId}:${organizationId}`;
  const eligible = paidActivationVerified && Boolean(userId && organizationId)
    && affiliate?.organizationId === organizationId && affiliate.canManage;
  useEffect(() => {
    if (!eligible) { setOpenKey(null); return; }
    try {
      if (localStorage.getItem(key) === "acknowledged") { setOpenKey(null); return; }
    } catch { /* Storage restrictions do not prevent this session's onboarding. */ }
    setOpenKey(key);
  }, [eligible, key]);
  function dismiss() {
    try { localStorage.setItem(key, "acknowledged"); } catch { /* Session-only dismissal. */ }
    setOpenKey(null);
  }
  return <OrganizationPaidSuccessPrompt
    open={Boolean(eligible && openKey === key)}
    hasLinkedRewardful={Boolean(affiliate?.hasLinkedRewardful)}
    onDismiss={dismiss}
    onContinue={() => { dismiss(); onOpenPartnerRevenue(); }}
  />;
}
