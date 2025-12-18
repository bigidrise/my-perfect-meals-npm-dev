import { WomenToggleId } from "./hormones.toggles";

export type WomenHormonesState = {
  toggles: Partial<Record<WomenToggleId, boolean>>;
  cycle: {
    lastPeriodISO?: string;
    cycleLength?: number;
    birthControl?: boolean;
    today: { 
      energy?: "low"|"ok"|"high"; 
      cravings?: "savory"|"sweets"; 
      bloat?: boolean; 
      mood?: "good"|"neutral"|"low"; 
      notes?: string; 
    };
  };
  pregnancyMode: "off" | "T1" | "T2" | "T3";
};
