import { developmentUnreadRequest, traceDevelopmentUnread } from "../developmentUnreadTrace";

let mockDevelopment = true;
jest.mock("@/features/proUnreadFlag", () => ({
  get developmentProUnreadAuthorizationEnabled() { return mockDevelopment; },
}));

test("count snapshots retain rendered states without logging identities or content", () => {
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  try {
    traceDevelopmentUnread("sidebar", { count: 0, visible: true, indicatorOn: false, patientId: "PRIVATE" });
    traceDevelopmentUnread("portal", { count: 0, visible: false, highlightedClients: 0 });
    traceDevelopmentUnread("hook", { count: 0, request: 7, status: 200, accepted: true, body: "PRIVATE" });
    expect(log.mock.calls.at(-1)?.[1]).toEqual({
      stage: "hook", snapshot: expect.objectContaining({
        sidebar: { count: 0, visible: true, indicatorOn: false },
        portal: { count: 0, visible: false, highlightedClients: 0 },
        hook: { count: 0, request: 7, status: 200, accepted: true },
      }),
    });
    traceDevelopmentUnread("hook", { count: { private: "PRIVATE" } });
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
  } finally { log.mockRestore(); }
});

test("Production emits no diagnostic snapshot", () => {
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  mockDevelopment = false;
  try {
    traceDevelopmentUnread("hook", { count: 3 });
    expect(log).not.toHaveBeenCalled();
  } finally { mockDevelopment = true; log.mockRestore(); }
});

test("only positive numeric diagnostic request headers are accepted", () => {
  expect(developmentUnreadRequest({ headers: { get: () => "17" } } as any)).toBe(17);
  expect(developmentUnreadRequest({ headers: { get: () => "PRIVATE" } } as any)).toBeUndefined();
  expect(developmentUnreadRequest({} as any)).toBeUndefined();
});
