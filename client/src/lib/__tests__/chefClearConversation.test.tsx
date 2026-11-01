/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CoachsCorner from "@/pages/CoachsCorner";

const mockAPI = jest.fn();
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => true }));
jest.mock("wouter", () => ({ useLocation: () => ["/coach-corner/home", jest.fn()] }));
jest.mock("@/components/voice/VoiceInputButton", () => ({
  VoiceInputButton: () => <button>Voice</button>,
}));
// Deliberately use the real Radix Dialog, including its portal and dismiss handlers.
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
let warnings: jest.SpyInstance;
let diagnostics: jest.SpyInstance;
const privateText = "PRIVATE_CONVERSATION_CONTENT_SENTINEL";
const empty = { profileCompleted: false, profile: null, conversationId: null,
  messages: [], hasOlderMessages: false, dueFollowup: null };

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setScheduler(callback => callback());
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.scrollTo = jest.fn();
  warnings = jest.spyOn(console, "warn").mockImplementation(() => {});
  diagnostics = jest.spyOn(console, "info").mockImplementation(() => {});
  mockAPI.mockReset();
  mockAPI.mockImplementation(async () => empty);
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity, queryFn: ({ queryKey }) => mockAPI(queryKey[0]) },
    mutations: { retry: false },
  } });
});
afterEach(() => {
  act(() => root.unmount());
  client.clear(); host.remove();
  warnings.mockRestore(); diagnostics.mockRestore();
  notifyManager.setScheduler(callback => setTimeout(callback, 0));
});
async function renderConversation(id: string | null = "private-conversation-id") {
  client.setQueryData(["/api/coach/bootstrap"], { ...empty, conversationId: id,
    messages: [{ id: "private-message-id", role: "user", content: privateText,
      structured_payload: null, created_at: "2026-01-01T00:00:00Z" }] });
  await act(async () => root.render(
    <QueryClientProvider client={client}><CoachsCorner /></QueryClientProvider>,
  ));
}
async function openDialog() {
  await act(async () => (host.querySelector('[aria-label="Clear conversation"]') as HTMLButtonElement).click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Clear this conversation?");
}
function confirmButton(): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
    .find(button => /^(Clear|Try again|Clearing…)$/u.test(button.textContent ?? ""))!;
}
function deletes() {
  return mockAPI.mock.calls.filter(([, options]) => options?.method === "DELETE");
}
async function clickConfirm() { await act(async () => confirmButton().click()); }

test("real confirmation cancellation never sends DELETE or removes messages", async () => {
  await renderConversation(); await openDialog();
  const cancel = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
    .find(button => button.textContent === "Cancel")!;
  await act(async () => cancel.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).toContain(privateText);
  expect(deletes()).toHaveLength(0);
});

test.each([401, 403, 404, 500])("HTTP %s stays visible, preserves messages/cache/ID and allows retry", async status => {
  await renderConversation();
  mockAPI.mockRejectedValueOnce(new Error(`${status}: PRIVATE_BACKEND_ERROR_SENTINEL`));
  await openDialog(); await clickConfirm();
  expect(document.querySelector('[role="dialog"] [role="alert"]')).not.toBeNull();
  expect(host.textContent).toContain(privateText);
  expect(client.getQueryData<any>(["/api/coach/bootstrap"]).conversationId).toBe("private-conversation-id");
  expect(confirmButton().textContent).toBe("Try again");
  expect(confirmButton().disabled).toBe(false);
  const serialized = JSON.stringify(warnings.mock.calls);
  expect(serialized).toContain(`"status":${status}`);
  expect(serialized).not.toMatch(/PRIVATE_|private-conversation-id|private-message-id/);
  mockAPI.mockImplementation(async (_path, options) => options?.method === "DELETE" ? { success: true } : empty);
  await clickConfirm();
  expect(deletes()).toHaveLength(2);
  expect(deletes()[1][0]).toBe(deletes()[0][0]);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain(privateText);
  expect(client.getQueryData<any>(["/api/coach/bootstrap"]).messages).toEqual([]);
  expect(host.querySelector("textarea")?.disabled).toBe(false);
});

test.each([new TypeError("Failed to fetch"), new Error("PRIVATE_UNEXPECTED_RESPONSE")])(
  "network/unexpected failures keep the actual dialog open", async error => {
    await renderConversation(); mockAPI.mockRejectedValueOnce(error);
    await openDialog(); await clickConfirm();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Please try again");
    expect(host.textContent).toContain(privateText);
    expect(JSON.stringify(warnings.mock.calls)).not.toMatch(/PRIVATE_|private-conversation-id/);
  },
);

test("missing conversation ID is explained without DELETE or message loss", async () => {
  await renderConversation(null); await openDialog(); await clickConfirm();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("isn't ready to clear");
  expect(host.textContent).toContain(privateText);
  expect(deletes()).toHaveLength(0);
  expect(warnings).toHaveBeenCalledWith("[AskChefClear]", expect.objectContaining({ outcome: "missing_id" }));
});

test("rapid duplicate confirmations and dismiss attempts cannot interrupt delayed deletion", async () => {
  let finish!: (value: unknown) => void;
  const delayed = new Promise(resolve => { finish = resolve; });
  await renderConversation();
  mockAPI.mockImplementation((_path, options) => options?.method === "DELETE" ? delayed : Promise.resolve(empty));
  await openDialog();
  const button = confirmButton();
  await act(async () => {
    button.click(); button.click();
  });
  expect(deletes()).toHaveLength(1);
  expect(confirmButton().textContent).toBe("Clearing…");
  expect(confirmButton().disabled).toBe(true);
  expect(host.textContent).toContain(privateText);
  expect(host.querySelector("textarea")?.disabled).toBe(true);
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => finish({ success: true }));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain(privateText);
  expect(diagnostics).toHaveBeenCalledWith("[AskChefClear]", expect.objectContaining({
    outcome: "succeeded", elapsedMs: expect.any(Number),
  }));
});

test("delayed failure restores retry instead of dismissing the confirmation", async () => {
  let fail!: (reason: unknown) => void;
  const delayed = new Promise((_resolve, reject) => { fail = reject; });
  await renderConversation();
  mockAPI.mockReturnValueOnce(delayed);
  await openDialog(); await clickConfirm();
  await act(async () => fail(new Error("500: PRIVATE_SERVER_DETAILS")));
  expect(confirmButton().textContent).toBe("Try again");
  expect(confirmButton().disabled).toBe(false);
  expect(host.textContent).toContain(privateText);
});

test("a successful HTTP response without explicit deletion acknowledgement cannot clear history", async () => {
  await renderConversation(); mockAPI.mockResolvedValueOnce({});
  await openDialog(); await clickConfirm();
  expect(host.textContent).toContain(privateText);
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});

test("success replaces stale bootstrap data even when the subsequent refresh fails", async () => {
  await renderConversation();
  mockAPI.mockImplementation(async (_path, options) => {
    if (options?.method === "DELETE") return { success: true };
    throw new Error("Offline refresh");
  });
  await openDialog(); await clickConfirm();
  expect(host.textContent).not.toContain(privateText);
  expect(client.getQueryData<any>(["/api/coach/bootstrap"]).conversationId).toBeNull();
  expect(client.getQueryData<any>(["/api/coach/bootstrap"]).messages).toEqual([]);
});
