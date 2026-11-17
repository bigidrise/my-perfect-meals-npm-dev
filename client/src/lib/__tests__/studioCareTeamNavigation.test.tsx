/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DesktopLayout from "@/layout/DesktopLayout";
import StudioBottomNav from "@/components/pro/StudioBottomNav";
import type { WorkspaceAvailability } from "@shared/workspaceAvailability";

const mockNavigate = jest.fn();
let mockRole: string | undefined;
let mockAvailability: WorkspaceAvailability;
jest.mock("wouter", () => ({
  useLocation: () => ["/pro/clients", mockNavigate],
  Link: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({t: (key: string) => ({
    careTeam: "Care Team", proPortal: "Pro Portal",
  } as Record<string, string>)[key] ?? key}),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({user:{id:"studio-navigation-fixture",professionalRole:mockRole}}),
}));
jest.mock("@/layout/DesktopHeader", () => ({__esModule:true,default:()=>null}));
jest.mock("@/components/WorkspaceChooser", () => ({WorkspaceChooser:()=>null}));
jest.mock("@/components/chef/ChefEmojiButton", () => ({__esModule:true,default:()=>null}));
jest.mock("@/hooks/useProUnreadCount", () => ({useProUnreadCount:()=>0}));
jest.mock("@/lib/workspaceAvailability", () => ({
  fetchWorkspaceAvailability: async () => mockAvailability,
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockRole = undefined;
  mockAvailability = {
    personal:{available:true,destination:"/dashboard"},
    organization:{available:false,destination:null,organizations:[]},
    studio:{available:true,destination:"/pro/clients",readiness:"ready"},
  };
});
afterEach(cleanup);

describe.each(["desktop","mobile"])("%s Studio navigation", surface => {
  function renderNavigation() {
    return render(surface === "desktop"
      ? <DesktopLayout><p>Studio content</p></DesktopLayout>
      : <StudioBottomNav />);
  }

  test.each([
    [undefined, "/pro/clients", "/care-team/trainer"],
    ["trainer", "/pro/clients", "/care-team/trainer"],
    ["physician", "/pro/physician-clients", "/care-team/physician"],
  ])("shows Care Team before Pro Portal and navigates correctly for role %p", async (role, studioDestination, careTeamDestination) => {
    mockRole = role;
    mockAvailability.studio.destination = studioDestination!;
    renderNavigation();
    const careTeam = await screen.findByRole("button",{name:"Care Team"});
    const portal = screen.getByRole("button",{name:"Pro Portal"});
    expect(careTeam.compareDocumentPosition(portal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(careTeam);
    expect(mockNavigate).toHaveBeenLastCalledWith(careTeamDestination);
    if (surface === "desktop") expect(localStorage.getItem("mpm_active_space")).toBe("workspace");
    fireEvent.click(portal);
    expect(mockNavigate).toHaveBeenLastCalledWith(studioDestination);
  });

  test("does not show Care Team when Studio is unavailable", async () => {
    mockAvailability.studio = {available:false,destination:null,readiness:null};
    // Flush asynchronous discovery without touching any real API.
    await act(async () => { renderNavigation(); });
    expect(screen.queryByRole("button",{name:"Care Team"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Pro Portal"})).not.toBeInTheDocument();
  });
});
