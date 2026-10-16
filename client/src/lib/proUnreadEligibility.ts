export interface ProUnreadIdentity {
  id?: string;
  isProCare?: boolean | null;
  professionalRole?: string | null;
}

export function canPollProfessionalUnread(
  user: ProUnreadIdentity | null | undefined,
  allowServerAuthorizationCheck = false,
): boolean {
  // This permits only an initial request to the existing protected endpoint.
  // Neither role metadata, Studio ownership nor admin status grants access.
  if (allowServerAuthorizationCheck) return !!user?.id;
  if (!user?.isProCare) return false;
  return user.professionalRole === "physician" || user.professionalRole === "trainer";
}