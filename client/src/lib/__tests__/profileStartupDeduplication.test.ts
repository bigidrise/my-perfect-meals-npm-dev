import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile startup request ownership", () => {
  it("keeps profile fetching in AuthContext behind one in-flight request", () => {
    const source = read("client/src/contexts/AuthContext.tsx");
    expect(source).toContain("profileRefreshSingleFlight.current.run(fetchFreshUser)");
    expect(source.split('apiUrl(`/api/user/profile`)')).toHaveLength(2);
  });

  it("does not initialize timezone while initial auth is unresolved", () => {
    const source = read("client/src/components/CanonicalTimezonePrompt.tsx");
    expect(source).toContain("if (loading || !user || !deviceTimezone) return;");
  });
});