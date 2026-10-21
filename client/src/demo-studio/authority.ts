/** Pure policy: UI demo identity is never a credential for an application API. */
export interface DemoAuthority {
  development: boolean;
  production: boolean;
  mode: string;
  childFrame: boolean;
  opaqueOrigin: boolean;
  srcDoc: boolean;
  marker: boolean;
}

export function permitsDemoIdentity(a: DemoAuthority): boolean {
  return a.development && !a.production && a.mode === "development"
    && a.childFrame && a.opaqueOrigin && a.srcDoc && a.marker;
}

export function assertSyntheticIdentity(user: { id?: string; email?: string; role?: string;
  isAdmin?: boolean; isFounder?: boolean; professionalRole?: unknown } | null): void {
  if (!user || user.id !== "demo-studio-user" ||
      user.email !== "demo@myperfectmeals.invalid" || user.role !== "client" ||
      user.isAdmin || user.isFounder || user.professionalRole) {
    throw new Error("Demo Studio accepts its synthetic client identity only");
  }
}
