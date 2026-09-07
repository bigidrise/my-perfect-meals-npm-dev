export interface ProUnreadIdentity {
  isProCare?: boolean | null;
  professionalRole?: string | null;
}

export function canPollProfessionalUnread(
  user: ProUnreadIdentity | null | undefined,
): boolean {
  if (!user?.isProCare) return false;
  return user.professionalRole === "physician" || user.professionalRole === "trainer";
}