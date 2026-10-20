import { AdvisorPanel } from "../../../../pairing-advisor/AdvisorPanel";

declare const __PAIRING_SYNTHETIC_PREVIEW__: boolean;
export function PairingAdvisor() {
  if (!__PAIRING_SYNTHETIC_PREVIEW__) return null;
  return <AdvisorPanel />;
}

export default PairingAdvisor;
