/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CoachsCorner from "@/pages/CoachsCorner";
import ChefConversationEntry from "@/components/coaching/ChefConversationEntry";
import { chefNavigationRoute } from "@shared/coaching/creatorRequest";

let mockConversationEnabled = true;
const mockNavigate = jest.fn();
const mockAPI = jest.fn();
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => mockConversationEnabled }));
jest.mock("wouter", () => ({
  useLocation: () => ["/coach-corner/home", mockNavigate],
  Redirect: ({ to }: { to: string }) => { mockNavigate(to); return null; },
}));
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));
jest.mock("@/components/voice/VoiceInputButton", () => ({ VoiceInputButton: () => null }));
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = jest.fn();
  mockConversationEnabled = true; mockNavigate.mockReset(); mockAPI.mockReset();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity,
    queryFn: ({ queryKey }) => mockAPI(queryKey[0]) }, mutations: { retry: false } } });
});
afterEach(() => { act(() => root.unmount()); client.clear(); host.remove(); });
async function renderPage(completed: boolean, messages: any[] = []) {
  client.setQueryData(["/api/coach/bootstrap"], {
    profileCompleted: completed, profile: completed ? { personality: "STORED_STYLE_SENTINEL" } : null,
    conversationId: messages.length ? "stored-conversation" : null,
    messages, hasOlderMessages: false, dueFollowup: { id: "old-queued-followup" },
  });
  await act(async () => { root.render(<QueryClientProvider client={client}><CoachsCorner /></QueryClientProvider>); });
}

test.each([false, true])("actual chat page is immediately usable with assessment completion=%s", async completed => {
  await renderPage(completed);
  const textarea = host.querySelector("textarea")!;
  expect(textarea).not.toBeNull();
  expect(textarea.disabled).toBe(false);
  expect(host.textContent).toContain("What can I help you with?");
  expect(host.textContent).not.toMatch(/assessment|questionnaire|Edit profile|Retake|STORED_STYLE_SENTINEL/i);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockAPI).not.toHaveBeenCalled(); // No questions, profile or queued behavioral follow-up.
});

test("a member without assessment can send, see the concise reply, and continue the conversation", async () => {
  await renderPage(false);
  mockAPI.mockResolvedValue({ conversationId: "current-conversation", messageId: "answer-1",
    response: { presentation: { kind: "concierge", message: "Savory, sweet, or something light?" },
      whatIFound: "INTERNAL_TEXT", whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null } });
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    textarea.value = "I'm hungry.";
    Simulate.change(textarea, { target: textarea } as any);
  });
  await act(async () => { (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click(); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(mockAPI).toHaveBeenCalledWith("/api/coach/message", expect.objectContaining({
    body: JSON.stringify({ message: "I'm hungry.", specialization: "corner" }),
  }));
  expect(host.textContent).toContain("Savory, sweet, or something light?");
  expect(host.textContent).not.toContain("INTERNAL_TEXT");
  expect(host.querySelectorAll('button').length).toBeGreaterThan(0);
  mockAPI.mockClear();
  mockAPI.mockResolvedValueOnce({ conversationId: "current-conversation", messageId: "answer-2",
    response: { presentation: { kind: "concierge", message: "Spicy, tangy, or fresh?" },
      whatIFound: "", whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null } });
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    textarea.value = "Something light.";
    Simulate.change(textarea, { target: textarea } as any);
  });
  await act(async () => { (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click(); });
  expect(mockAPI).toHaveBeenCalledWith("/api/coach/message", expect.objectContaining({
    body: JSON.stringify({ message: "Something light.", specialization: "corner", conversationId: "current-conversation" }),
  }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(host.textContent).toContain("Spicy, tangy, or fresh?");
});

test("stored conversations still render for an unassessed member", async () => {
  await renderPage(false, [{
    id: "old-answer", role: "assistant", created_at: "2026-01-01T00:00:00Z",
    structured_payload: { whatIFound: "Your previous conversation is here.", whatItCouldMean: "",
      todayPlan: null, learningOpportunity: null },
  }]);
  expect(host.textContent).toContain("Your previous conversation is here.");
  expect(host.textContent).not.toMatch(/Edit profile|Retake full assessment/);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("historical assessment entry component redirects straight to conversation", () => {
  act(() => root.render(<ChefConversationEntry />));
  expect(mockNavigate).toHaveBeenCalledWith("/coach-corner/home");
  expect(host.textContent).toBe("");
});

test("Production-mode page retains its historical assessment redirect", async () => {
  mockConversationEnabled = false;
  await renderPage(false);
  expect(mockNavigate).toHaveBeenCalledWith("/coach-corner/intake");
});

test.each([
  "Light, flavorful, savory, broth-based chicken soup to make at home.",
  "Chicken Caesar salad",
])("restored Chef request reaches the validated Create a Dish prefill only after a member click: %s", async idea => {
  const creatorRequest = { destinationId: "create_a_dish" as const,
    idea };
  await renderPage(false, [{
    id: "soup-answer", role: "assistant", created_at: "2026-01-01T00:00:00Z",
    structured_payload: {
      presentation: { kind: "concierge", message: "Let's use Create a Dish.", destinationId: "create_a_dish", creatorRequest },
      whatIFound: "", whatItCouldMean: "", learningOpportunity: null,
      todayPlan: { why: "", items: [{ kind: "use_feature", destinationId: "create_a_dish", text: "Open Create a Dish" }] },
    },
  }]);
  const buttons = [...host.querySelectorAll("button")].filter(button => button.textContent === "Open Create a Dish");
  expect(buttons).toHaveLength(1);
  expect(mockAPI).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  const route = chefNavigationRoute("create_a_dish", creatorRequest);
  mockAPI.mockResolvedValue({ destinationId: "create_a_dish", route });
  await act(async () => buttons[0].click());
  expect(mockAPI).toHaveBeenCalledTimes(1);
  expect(mockAPI).toHaveBeenCalledWith("/api/coach/navigation", {
    method: "POST", body: JSON.stringify({ destinationId: "create_a_dish", creatorRequest }),
  });
  expect(mockNavigate).toHaveBeenCalledWith(route);
});

test("breakfast shake discovery renders naturally, then offers Beverage Creator only when ready", async () => {
  await renderPage(false);
  const question = "A shake sounds great for a light breakfast! Are you thinking something fruity and refreshing or something creamy and filling?";
  mockAPI.mockResolvedValueOnce({
    conversationId: "breakfast-conversation", messageId: "breakfast-discovery",
    response: { presentation: { kind: "concierge", message: question },
      whatIFound: question, whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null },
  });
  const send = async (message: string) => {
    await act(async () => {
      const textarea = host.querySelector("textarea")!;
      textarea.value = message;
      Simulate.change(textarea, { target: textarea } as any);
    });
    await act(async () => { (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  };
  await send("I'm in the mood. I need to eat breakfast, but I don't want nothing heavy. I want maybe a shake. What do you think?");
  expect(host.textContent).toContain(question);
  expect(host.textContent).not.toContain("I couldn't complete");
  expect([...host.querySelectorAll("button")].some(button => button.textContent === "Open Beverage Creator")).toBe(false);
  expect(mockNavigate).not.toHaveBeenCalled();
  mockAPI.mockResolvedValueOnce({
    conversationId: "breakfast-conversation", messageId: "breakfast-ready",
    response: { presentation: { kind: "concierge", message: "Let's use Beverage Creator.", destinationId: "beverage_creator" },
      whatIFound: "", whatItCouldMean: "", todayPlan: { items: [{ kind: "use_feature", destinationId: "beverage_creator" }] },
      learningOpportunity: null },
  });
  await send("Fruity and refreshing. Help me make a light breakfast shake.");
  const buttons = [...host.querySelectorAll("button")].filter(button => button.textContent === "Open Beverage Creator");
  expect(buttons).toHaveLength(1);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockAPI).toHaveBeenNthCalledWith(2, "/api/coach/message", expect.objectContaining({
    body: JSON.stringify({ message: "Fruity and refreshing. Help me make a light breakfast shake.",
      specialization: "corner", conversationId: "breakfast-conversation" }),
  }));
  mockAPI.mockResolvedValueOnce({ destinationId: "beverage_creator", route: "/lifestyle/beverage-creator" });
  await act(async () => buttons[0].click());
  expect(mockNavigate).toHaveBeenCalledWith("/lifestyle/beverage-creator");
  expect(mockAPI).toHaveBeenCalledTimes(3); // Two messages, one click-time access check; no generation.
});
