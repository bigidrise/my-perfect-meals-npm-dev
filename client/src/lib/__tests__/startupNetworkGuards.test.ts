import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("bounded startup network guards", () => {
  it("waits for auth and single-flights macro synchronization", () => {
    const source = read("client/src/hooks/useMacroTargetSync.ts");
    expect(source).toContain("if (authLoadingRef.current || !requestedUserId) return;");
    expect(source).toContain("macroSyncSingleFlight.current.run");
    expect(source).toContain("userIdRef.current !== requestedUserId");
    expect(source).toContain("setInterval(sync, POLL_INTERVAL_MS)");
  });

  it("requires resolved ProCare professional identity for unread polling", () => {
    const source = read("client/src/hooks/useProUnreadCount.ts");
    expect(source).toContain("canPollProfessionalUnread(user)");
    expect(source).toContain("const eligible = !loading && canPollProfessionalUnread(user)");
  });

  it("stops professional polling after an authorization rejection", () => {
    const source = read("client/src/hooks/useProUnreadCount.ts");
    expect(source).toContain("res.status === 401 || res.status === 403");
    expect(source).toContain("terminalIdentity = identity");
    expect(source).toContain("stopPolling()");
  });
});