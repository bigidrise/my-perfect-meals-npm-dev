/** Demo pages never mount live professional pages or infer patient authority from a URL. */
export type DemoPhysicianPage =
  | { kind: "home" | "portal" | "care-team" | "clients" }
  | { kind: "client"; patientId: string }
  | { kind: "unavailable" };

export const DEMO_PHYSICIAN_NAVIGATION = [
  { label: "Physician Studio", path: "/dashboard", kind: "home" },
  { label: "Pro Portal", path: "/pro-portal", kind: "portal" },
  { label: "Care Team", path: "/care-team/physician", kind: "care-team" },
  { label: "Clients", path: "/pro/physician-clients", kind: "clients" },
] as const;

export function demoPhysicianPage(path: string): DemoPhysicianPage {
  const pathname = path.split(/[?#]/)[0];
  if (["/", "/dashboard", "/pro-launchpad", "/professional-dashboard"].includes(pathname)) return { kind: "home" };
  if (["/pro-portal", "/pro/physician"].includes(pathname)) return { kind: "portal" };
  if (["/care-team", "/care-team/physician"].includes(pathname)) return { kind: "care-team" };
  if (["/pro/physician-clients", "/pro/clients", "/demo-physician"].includes(pathname)) return { kind: "clients" };
  const match = /^\/pro\/clients\/([^/]+)\/clinician$/.exec(pathname);
  if (match) {
    try {
      const patientId = decodeURIComponent(match[1]);
      if (patientId && !/[\/\\]/.test(patientId)) return { kind: "client", patientId };
    } catch { /* An invalid route must not become a patient lookup. */ }
  }
  return { kind: "unavailable" };
}

export function demoPhysicianClientPath(patientId: string) {
  return `/pro/clients/${encodeURIComponent(patientId)}/clinician`;
}
