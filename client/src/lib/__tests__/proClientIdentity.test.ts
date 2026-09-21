import {
  isCurrentVerifiedProClientRequest,
  resolveVerifiedProClientUserId,
} from "@/lib/proClientIdentity";

describe("professional client identity resolution", () => {
  it("uses only the verified user mapping for the currently selected client", () => {
    expect(resolveVerifiedProClientUserId({
      id: "relationship-a",
      name: "Client A",
      clientUserId: "user-a",
    }, "relationship-a")).toBe("user-a");
  });

  it("never falls back to a relationship or route identifier", () => {
    expect(resolveVerifiedProClientUserId({
      id: "relationship-a",
      name: "Client A",
    }, "relationship-a")).toBeNull();
  });

  it("withholds the previous client identity during a rapid client switch", () => {
    const previousClient = {
      id: "relationship-a",
      name: "Client A",
      clientUserId: "user-a",
    };
    expect(resolveVerifiedProClientUserId(previousClient, "relationship-b")).toBeNull();
  });

  it("withholds child-component identity when the selected relationship has no loaded client", () => {
    expect(resolveVerifiedProClientUserId(undefined, "relationship-b")).toBeNull();
  });

  it("rejects a late response from the previously selected client", () => {
    expect(isCurrentVerifiedProClientRequest("user-b", "user-a")).toBe(false);
    expect(isCurrentVerifiedProClientRequest(null, "user-a")).toBe(false);
    expect(isCurrentVerifiedProClientRequest("user-b", "user-b")).toBe(true);
  });
});