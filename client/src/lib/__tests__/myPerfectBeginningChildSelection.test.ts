import fs from "node:fs";
import path from "node:path";
import {
  reconcileRememberedChildSelection,
  resolveRememberedProfileId,
} from "@/lib/myPerfectBeginningChildSelection";

const GENERAL = "GENERAL";

describe("My Perfect Beginnings child selection recovery", () => {
  it("clears a stale stored child when the server has no authorized children", () => {
    expect(reconcileRememberedChildSelection("missing-child", [], GENERAL)).toEqual({
      activeChildId: null,
      shouldClearRememberedId: true,
    });
    expect(resolveRememberedProfileId("missing-child", [], GENERAL)).toBeNull();
  });

  it("reconciles a stale stored child to the first authorized child on the hub", () => {
    expect(reconcileRememberedChildSelection(
      "missing-child",
      ["authorized-a", "authorized-b"],
      GENERAL,
    )).toEqual({
      activeChildId: "authorized-a",
      shouldClearRememberedId: true,
    });
  });

  it("preserves a valid stored child", () => {
    expect(reconcileRememberedChildSelection(
      "authorized-b",
      ["authorized-a", "authorized-b"],
      GENERAL,
    )).toEqual({
      activeChildId: "authorized-b",
      shouldClearRememberedId: false,
    });
    expect(resolveRememberedProfileId(
      "authorized-b",
      ["authorized-a", "authorized-b"],
      GENERAL,
    )).toBe("authorized-b");
  });

  it("never resolves a foreign or archived child omitted from the authorized active list", () => {
    const authorizedActiveIds = ["authorized-active"];
    expect(resolveRememberedProfileId("foreign-child", authorizedActiveIds, GENERAL)).toBeNull();
    expect(resolveRememberedProfileId("archived-child", authorizedActiveIds, GENERAL)).toBeNull();
  });

  it("keeps Child A and Child B isolated during explicit switching", () => {
    expect(reconcileRememberedChildSelection(
      "child-a",
      ["child-a", "child-b"],
      GENERAL,
    ).activeChildId).toBe("child-a");
    expect(reconcileRememberedChildSelection(
      "child-b",
      ["child-a", "child-b"],
      GENERAL,
    ).activeChildId).toBe("child-b");
  });

  it("starts Add Child cleanly and makes a newly created child active", () => {
    const hub = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/lifestyle/MyPerfectBeginningPage.tsx"),
      "utf8",
    );
    const profile = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/lifestyle/MyPerfectBeginningProfilePage.tsx"),
      "utf8",
    );

    const addChildStart = hub.indexOf("{/* Add Child Profile */}");
    const addChildEnd = hub.indexOf("</button>", addChildStart);
    const addChildSource = hub.slice(addChildStart, addChildEnd);
    expect(addChildSource).toContain("localStorage.removeItem(LS_ACTIVE_CHILD_KEY)");
    expect(addChildSource).toContain('setLocation("/lifestyle/my-perfect-beginning/profile")');
    expect(profile).toContain("localStorage.setItem(LS_ACTIVE_CHILD_KEY, saved.id)");
  });
});