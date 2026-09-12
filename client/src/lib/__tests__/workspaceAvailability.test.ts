import {
  decideSignInWorkspace,
  hasStudioWorkspaceAccess,
} from "@/lib/workspaceAvailability";

describe("sign-in workspace availability", () => {
  const personal = { isProCare: false, professionalRole: null };
  const organizationOnly = { isProCare: false, professionalRole: "business" };
  const studioOnly = { isProCare: true, professionalRole: "trainer" };
  const allThree = { isProCare: true, professionalRole: "business" };

  it("routes a personal-only user directly to Personal", () => {
    expect(decideSignInWorkspace(personal, false)).toBe("personal");
  });

  it("shows Personal and Organization without requiring Studio", () => {
    expect(hasStudioWorkspaceAccess(organizationOnly)).toBe(false);
    expect(decideSignInWorkspace(organizationOnly, true)).toBe("chooser");
  });

  it("shows the chooser for Personal and Studio without Organization", () => {
    expect(hasStudioWorkspaceAccess(studioOnly)).toBe(true);
    expect(decideSignInWorkspace(studioOnly, false)).toBe("chooser");
  });

  it("shows the chooser when Personal, Organization, and Studio are available", () => {
    expect(hasStudioWorkspaceAccess(allThree)).toBe(true);
    expect(decideSignInWorkspace(allThree, true)).toBe("chooser");
  });

  it("does not use the business role alone to choose Organization", () => {
    expect(decideSignInWorkspace(organizationOnly, false)).toBe("personal");
  });
});