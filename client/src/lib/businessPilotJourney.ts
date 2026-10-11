export function isPatientInvitation(value: {
  invitationType?: string; populationType?: string;
}): boolean {
  return value.invitationType === "client" || value.populationType === "client";
}

export function invitationDestination(invitation: {
  invitationType?: string; populationType?: string;
}, onboardingCompleted: boolean): string {
  return isPatientInvitation(invitation)
    ? (onboardingCompleted ? "/dashboard" : "/onboarding")
    : "/business-dashboard";
}
