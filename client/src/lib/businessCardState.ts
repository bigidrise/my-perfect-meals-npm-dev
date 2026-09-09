export type BusinessCardDetails = {
  mode: "owner" | "member";
  name: string;
  usedSeats?: number;
  seatLimit?: number;
  role?: string;
};

export type BusinessCardState =
  | { state: "loading" }
  | ({ state: "active" } & BusinessCardDetails)
  | ({ state: "incomplete" } & BusinessCardDetails)
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
      return {
        state: "active",
        mode: "owner",
        name: data.business.name,
        usedSeats: data.usedSeats,
        seatLimit: data.business.seatLimit,
      };
    }

    const memberRes = await request("/api/business/membership");
    if (memberRes.ok) {
      const data = await memberRes.json();
      if (!data?.membership?.businessName) return { state: "error" };
      return {
        state: "active",
        mode: "member",
        name: data.membership.businessName,
        role: data.membership.role,
      };
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
  destination: "/business-dashboard" | "/business/start" | null;
} {
  switch (state.state) {
    case "active":
      return {
        title: "Open Organization Dashboard",
        description: `${state.name} · Clients & Team Members`,
        destination: "/business-dashboard",
      };
    case "incomplete":
      return {
        title: "Complete Organization Setup",
        description: `${state.name} · Setup before payment`,
        destination: "/business/start",
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