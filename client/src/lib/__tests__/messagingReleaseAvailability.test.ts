import fs from "node:fs";
import { developmentClientMessagingEnabled } from "@/features/clientMessagingFlag";
import { developmentProUnreadAuthorizationEnabled } from "@/features/proUnreadFlag";

describe("messaging release availability", () => {
  it("enables the real dashboard and unread policies without mocked feature flags", () => {
    expect(developmentClientMessagingEnabled).toBe(true);
    expect(developmentProUnreadAuthorizationEnabled).toBe(true);
  });

  it.each([
    "client/src/features/clientMessagingFlag.ts",
    "client/src/features/proUnreadFlag.ts",
  ])("does not tie %s to Vite's Development build mode", file => {
    expect(fs.readFileSync(file, "utf8")).not.toContain("import.meta.env");
  });
});
