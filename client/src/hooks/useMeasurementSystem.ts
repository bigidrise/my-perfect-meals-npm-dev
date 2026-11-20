import { useAuth } from "@/contexts/AuthContext";
import { resolveMeasurementSystem } from "@shared/units";

/** Derived directly from the current account; no independent state or cache. */
export function useMeasurementSystem() {
  const { user } = useAuth();
  return resolveMeasurementSystem(user?.measurementSystem, user?.countryCode);
}
