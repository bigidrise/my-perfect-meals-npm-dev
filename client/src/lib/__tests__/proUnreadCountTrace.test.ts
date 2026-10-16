import { traceProUnreadCount } from "@shared/proUnreadCountTrace";

describe("temporary unread count tracing privacy", () => {
  let log: jest.SpyInstance;
  beforeEach(() => { log = jest.spyOn(console, "info").mockImplementation(() => {}); });
  afterEach(() => { log.mockRestore(); });
  it("logs count-only metadata, never unrecognized fields", () => {
    const input = {
      count: 1, clients: 1, cacheHit: false, studioResolved: true,
      patientEmail: "synthetic-private@example.invalid", body: "synthetic private message",
      clientUserId: "synthetic-private-id",
    };
    traceProUnreadCount("server", input);
    expect(log).toHaveBeenCalledWith("[ProUnreadTrace]", {
      stage: "server", count: 1, countType: "number",
      clients: 1, cacheHit: false, studioResolved: true,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic");
  });
  it.each(["private message", { patient: "private" }, ["private"], null, undefined, NaN, Infinity])("does not log malformed count data", count => {
    traceProUnreadCount("hook", { count, accepted: false });
    const fields = log.mock.calls[0][1];
    expect(fields.count).toBeNull();
    expect(JSON.stringify(fields)).not.toContain("private");
  });
  it("records an existing sidebar's visibility decision without an identity", () => {
    traceProUnreadCount("sidebar", { count: 1, portalVisible: true, indicatorOn: true });
    expect(log).toHaveBeenCalledWith("[ProUnreadTrace]", {
      stage: "sidebar", count: 1, countType: "number", portalVisible: true, indicatorOn: true,
    });
  });
});
