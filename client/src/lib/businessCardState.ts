export type BusinessCardDetails = {
  mode: "owner" | "member";
  name: string;
  organizationCount?: number;
  usedSeats?: number;
  seatLimit?: number;
  role?: string;
};

export type BusinessCardState =
  | { state: "loading" }
  | ({ state: "active" } & BusinessCardDetails)
  | ({ state: "incomplete" } & BusinessCardDetails)
  | { state: "pilot-ready" }
  | { state: "none" }
  | { state: "error" };

export const INITIAL_BUSINESS_CARD_STATE: BusinessCardState = {
  state: "loading",
};

type BusinessRequest = (path: string) => Promise<Response>;

export async function resolveBusinessCardState(
  request: BusinessRequest,
): Promise<BusinessCardState> {
  try {
    const ownerRes = await request("/api/business/mine");
    if (ownerRes.ok) {
      const data = await ownerRes.json();
      if (!data?.business?.name) return { state: "error" };
      const workspaceRes = await request("/api/business/workspace/options");
      const workspaceData = workspaceRes.ok ? await workspaceRes.json() : null;
      const organizations = Array.isArray(workspaceData?.organizations) ? workspaceData.organizations : [];
      return {
        state: "active",
        mode: "owner",
        name: organizations.length === 1 ? organizations[0].name : data.business.name,
        organizationCount: organizations.length || 1,
        usedSeats: data.usedSeats,
        seatLimit: data.business.seatLimit,
      };
    }

    const memberRes = await request("/api/business/membership");
    if (memberRes.ok) {
      const data = await memberRes.json();
      if (!data?.membership?.businessName) return { state: "error" };
      const workspaceRes = await request("/api/business/workspace/options");
      const workspaceData = workspaceRes.ok ? await workspaceRes.json() : null;
      const organizations = Array.isArray(workspaceData?.organizations) ? workspaceData.organizations : [];
      return {
        state: "active",
        mode: "member",
        name: organizations.length === 1 ? organizations[0].name : data.membership.businessName,
        organizationCount: organizations.length || 1,
        role: data.membership.role,
      };
    }

    if (ownerRes.status === 409 || memberRes.status === 409) {
      const workspaceRes = await request("/api/business/workspace/options");
      if (workspaceRes.ok) {
        const workspaceData = await workspaceRes.json();
        const organizations = Array.isArray(workspaceData?.organizations) ? workspaceData.organizations : [];
        if (organizations.length > 0) {
          return {
            state: "active",
            mode: organizations.some((organization: any) => organization.role === "owner") ? "owner" : "member",
            name: organizations.length === 1 ? organizations[0].name : `${organizations.length} organizations`,
            organizationCount: organizations.length,
          };
        }
      }
    }

    const pilotWorkspaceRes = await request("/api/business/workspaces");
    if (pilotWorkspaceRes.ok) {
      const pilotWorkspaceData = await pilotWorkspaceRes.json();
      const workspaces = Array.isArray(pilotWorkspaceData?.workspaces) ? pilotWorkspaceData.workspaces : [];
      if (workspaces.some((workspace: any) => workspace.action === "setup")) {
        return { state: "pilot-ready" };
      }
    }

    // This is the only authoritative "none" check. The owner/member endpoints
    // may return 401/403/404 simply because their narrower permission gate does
    // not apply to this user.
    const statusRes = await request("/api/business/check-status");
    if (!statusRes.ok) return { state: "error" };

    const data = await statusRes.json();
    if (data?.exists === false) return { state: "none" };
    if (data?.exists !== true || !data?.name) return { state: "error" };

    return {
      state: data.status === "active" ? "active" : "incomplete",
      mode: data.callerRole === "owner" ? "owner" : "member",
      name: data.name,
    };
  } catch {
    return { state: "error" };
  }
}

export function businessCardPresentation(state: BusinessCardState): {
  title: string;
  description: string;
  destination: "/business-organizations" | "/business/start" | null;
} {
  switch (state.state) {
    case "active":
      return {
        title: state.organizationCount && state.organizationCount > 1 ? "Open Organization Hub" : "Open Organization Dashboard",
        description: state.organizationCount && state.organizationCount > 1
          ? `${state.organizationCount} organizations · Choose a workspace`
          : `${state.name} · Clients & Team Members`,
        destination: "/business-organizations",
      };
    case "incomplete":
      return {
        title: "Complete Organization Setup",
        description: `${state.name} · Setup before payment`,
        destination: "/business/start",
      };
    case "pilot-ready":
      return {
        title: "Open Organization Hub",
        description: "Your complimentary organization access is ready",
        destination: "/business-organizations",
      };
    case "none":
      return {
        title: "Start Your Organization",
        description: "$44.99/month · Set up your Business Suite",
        destination: "/business/start",
      };
    case "error":
      return {
        title: "Organization Access Unavailable",
        description: "Tap to try again",
        destination: null,
      };
    case "loading":
      return {
        title: "Checking Organization Access",
        description: "Loading your organization details…",
        destination: null,
      };
  }
}