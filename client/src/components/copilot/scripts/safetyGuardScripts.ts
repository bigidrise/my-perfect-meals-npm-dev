export interface SafetyGuardScript {
  id: string;
  title: string;
  spokenText: string;
}

export const SAFETY_GUARD_SCRIPTS: Record<string, SafetyGuardScript> = {
  blocked_allergy: {
    id: "blocked_allergy",
    title: "SafetyGuard™ Allergy Block",
    spokenText:
      "SafetyGuard stopped this meal because it includes an ingredient you've marked as an allergy. You can adjust the request to avoid that ingredient, or—if you're intentionally customizing—use the SafetyGuard Override to continue for this meal.",
  },

  override_tapped: {
    id: "override_tapped",
    title: "SafetyGuard™ Override",
    spokenText:
      "SafetyGuard allergy protection is currently on. If you want to turn it off for this meal, you'll need to enter your Safety PIN. This override applies to one meal only and turns back on automatically.",
  },

  pin_accepted: {
    id: "pin_accepted",
    title: "SafetyGuard™ PIN Accepted",
    spokenText:
      "SafetyGuard override confirmed. Allergy protection is off for this meal only. You're free to customize, and SafetyGuard will turn protection back on once the meal is generated.",
  },

  pin_incorrect: {
    id: "pin_incorrect",
    title: "SafetyGuard™ PIN Incorrect",
    spokenText:
      "That PIN doesn't match. SafetyGuard allergy protection is still on.",
  },

  generation_complete: {
    id: "generation_complete",
    title: "Meal Complete",
    spokenText:
      "This meal has been created. SafetyGuard allergy protection is back on.",
  },

  premade_blocked: {
    id: "premade_blocked",
    title: "SafetyGuard™ Premade Block",
    spokenText:
      "SafetyGuard blocked this meal because it contains an ingredient you've marked as an allergy. You can choose another option, or use the SafetyGuard Override if you're intentionally modifying this meal.",
  },
};

export function getSafetyGuardScript(scriptId: keyof typeof SAFETY_GUARD_SCRIPTS): SafetyGuardScript | undefined {
  return SAFETY_GUARD_SCRIPTS[scriptId];
}
