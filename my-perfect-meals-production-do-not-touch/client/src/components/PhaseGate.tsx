// ===========================================================
//  PhaseGate Component
//  Controls which features load based on development phase
// ===========================================================

import React from "react";
import { LAUNCH_PHASES } from "../featureFlags";

interface PhaseGateProps {
  phase: keyof typeof LAUNCH_PHASES;
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PhaseGate: React.FC<PhaseGateProps> = ({
  phase,
  feature,
  children,
  fallback = null,
}) => {
  const isEnabled = LAUNCH_PHASES[phase].includes(feature);
  return <>{isEnabled ? children : fallback}</>;
};

export default PhaseGate;
