/** @jest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { useProUnreadCount } from "../useProUnreadCount";

let mockUser: any;
let mockLoading = false;
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading }),
}));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({ "x-auth-token": "isolated-fixture" }) }));

const response = (count: unknown, status = 200) => ({
  ok: status === 200, status,
  json: async () => ({ totalUnread: count, clients: [] }),
}) as Response;
const flush = async () => { await act(async () => {}); };
let request: jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  mockLoading = false;
  mockUser = { id: "fixture-studio-owner", professionalRole: "business", isProCare: false, isAdmin: true };
  request = jest.fn().mockResolvedValue(response(0));
  global.fetch = request;
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });

test("a server-authorized business-role Studio can receive unread counts", async () => {
  request.mockResolvedValue(response(2));
  const { result } = renderHook(useProUnreadCount);
  await flush();
  expect(result.current).toBe(2);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith("/api/pro/tablet/unread-summary", {
    headers: { "x-auth-token": "isolated-fixture" }, credentials: "include",
  });
});

test.each([401, 403])("status %s denies even an admin/owner and stops retries", async status => {
  request.mockResolvedValue(response(99, status));
  const { result } = renderHook(useProUnreadCount);
  await flush();
  expect(result.current).toBe(0);
  await act(async () => { await jest.advanceTimersByTimeAsync(120_000); });
  expect(request).toHaveBeenCalledTimes(1);
});

test("a later authorization denial clears previously displayed unread counts", async () => {
  request.mockResolvedValueOnce(response(3)).mockResolvedValue(response(3, 403));
  const { result } = renderHook(useProUnreadCount);
  await flush();
  expect(result.current).toBe(3);
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(result.current).toBe(0);
  await act(async () => { await jest.advanceTimersByTimeAsync(90_000); });
  expect(request).toHaveBeenCalledTimes(2);
});

test("multiple workspace consumers share one authorization request and timer", async () => {
  const sidebar = renderHook(useProUnreadCount);
  const studio = renderHook(useProUnreadCount);
  await flush();
  expect(request).toHaveBeenCalledTimes(1);
  request.mockResolvedValue(response(1));
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(sidebar.result.current).toBe(1);
  expect(studio.result.current).toBe(1);
  expect(request).toHaveBeenCalledTimes(2);
  studio.unmount();
  request.mockResolvedValue(response(0));
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(sidebar.result.current).toBe(0);
  expect(request).toHaveBeenCalledTimes(3);
});

test.each(["text", "voice", "video"])("incoming %s count activates then a server read acknowledgment clears it", async () => {
  const { result } = renderHook(useProUnreadCount);
  await flush();
  expect(result.current).toBe(0);
  request.mockResolvedValue(response(1));
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(result.current).toBe(1);
  request.mockResolvedValue(response(0));
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(result.current).toBe(0);
  // The hook consumes only the server count; it never reads or writes a conversation.
  expect(request.mock.calls.every(([url]) => url === "/api/pro/tablet/unread-summary")).toBe(true);
});

test("pending requests do not overlap across multiple polling ticks", async () => {
  let resolve!: (value: Response) => void;
  request.mockReturnValueOnce(new Promise<Response>(yes => { resolve = yes; }));
  const { result } = renderHook(useProUnreadCount);
  await act(async () => { await jest.advanceTimersByTimeAsync(90_000); });
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(response(1)); });
  expect(result.current).toBe(1);
  request.mockReturnValue(new Promise(() => {}));
  await act(async () => { await jest.advanceTimersByTimeAsync(90_000); });
  expect(request).toHaveBeenCalledTimes(2);
});

test("an account switch ignores the prior account's delayed response", async () => {
  let resolve!: (value: Response) => void;
  request.mockReturnValueOnce(new Promise<Response>(yes => { resolve = yes; }))
    .mockResolvedValue(response(0));
  const { result, rerender } = renderHook(useProUnreadCount);
  mockUser = { id: "second-account", professionalRole: "client" };
  rerender();
  await flush();
  await act(async () => { resolve(response(8)); });
  expect(result.current).toBe(0);
});

test("logout and same-account sign-in reject the previous session's response", async () => {
  let resolve!: (value: Response) => void;
  request.mockReturnValueOnce(new Promise<Response>(yes => { resolve = yes; }))
    .mockResolvedValue(response(0));
  const identity = mockUser;
  const { result, rerender } = renderHook(useProUnreadCount);
  mockUser = null; rerender(); await flush();
  mockUser = identity; rerender(); await flush();
  await act(async () => { resolve(response(8)); });
  expect(result.current).toBe(0);
});

test.each([null, { id: "waiting-account" }])("anonymous or unresolved auth does not request unread data", async user => {
  mockUser = user;
  mockLoading = !!user;
  renderHook(useProUnreadCount);
  await flush();
  expect(request).not.toHaveBeenCalled();
});

test("transient network failure retries without treating it as authorization", async () => {
  request.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(response(1));
  const { result } = renderHook(useProUnreadCount);
  await flush();
  expect(result.current).toBe(0);
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(result.current).toBe(1);
});

test.each([-1, "3", null, 1.5])("invalid count %p never lights the indicator", async count => {
  request.mockResolvedValue(response(count));
  const { result } = renderHook(useProUnreadCount);
  await flush();
  expect(result.current).toBe(0);
});

test("a business identity asks the server for authorization in every build", async () => {
  request.mockResolvedValue(response(0, 403));
  renderHook(useProUnreadCount);
  await flush();
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { await jest.advanceTimersByTimeAsync(90_000); });
  expect(request).toHaveBeenCalledTimes(1);
});

test("the shared policy still polls for a ProCare trainer", async () => {
  mockUser = { id: "legacy-trainer", professionalRole: "trainer", isProCare: true };
  request.mockResolvedValue(response(1));
  const { result } = renderHook(useProUnreadCount);
  await flush();
  expect(result.current).toBe(1);
});
