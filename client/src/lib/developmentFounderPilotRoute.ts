/** Only this exact Development route may leave the founder demo workspace. */
export function isDevelopmentFounderPilotRoute(
  development: boolean,
  recognizedFounderSession: boolean,
  path: string,
): boolean {
  return development && recognizedFounderSession && path === "/admin/pilots";
}
