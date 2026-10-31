/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CoachsCorner from "@/pages/CoachsCorner";
import ChefConversationEntry from "@/components/coaching/ChefConversationEntry";
import { chefNavigationRoute } from "@shared/coaching/creatorRequest";

let mockConversationEnabled = true;
const mockNavigate = jest.fn();
const mockAPI = jest.fn();
const approvedNavigation = (destinationId: string) => ({
  state: "navigation_confirmed", destinationId,
  goal: { activity: "unknown", occasion: "unknown", restaurant: "unknown", dishChosen: false,
    specialty: "none", explicitFeatureId: null },
});
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => mockConversationEnabled }));
jest.mock("wouter", () => ({
  useLocation: () => ["/coach-corner/home", mockNavigate],
  Redirect: ({ to }: { to: string }) => { mockNavigate(to); return null; },
}));
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));
jest.mock("@/components/voice/VoiceInputButton", () => ({
  VoiceInputButton: ({ onChange, disabled, label }: any) =>
    <button aria-label={label} disabled={disabled} onClick={() => onChange("Voice-entered question")}>Voice</button>,
}));
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
  notifyManager.setScheduler(callback => callback());
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.scrollTo = jest.fn();
  mockConversationEnabled = true; mockNavigate.mockReset(); mockAPI.mockReset();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity,
    queryFn: ({ queryKey }) => mockAPI(queryKey[0]) }, mutations: { retry: false } } });
});
afterEach(() => {
  act(() => root.unmount()); client.clear(); host.remove();
  notifyManager.setScheduler(callback => { setTimeout(callback, 0); });
});
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

test.each([
  ["restaurant_guide", "Restaurant Guide", "/social-hub/restaurant-guide"],
  ["find_meals_near_me", "Find Meals Near Me", "/social-hub/find"],
  [null, null, "/dashboard"],
])("latest saved exchange restores after navigating to %s and back before cache expiry", async (destinationId, label, route) => {
  await renderPage(false);
  const response = {
    presentation: { kind: "concierge", message: "Your latest saved answer.",
      ...(destinationId ? { destinationId, navigation: approvedNavigation(destinationId) } : {}) },
    whatIFound: "", whatItCouldMean: "",
    todayPlan: { items: destinationId ? [{ kind: "use_feature", destinationId }] : [] }, learningOpportunity: null,
  };
  let resolveBootstrap!: (value: any) => void;
  mockAPI.mockImplementation((path: string) => {
    if (path === "/api/coach/bootstrap") return new Promise(resolve => { resolveBootstrap = resolve; });
    if (path === "/api/coach/navigation") return Promise.resolve({ destinationId, route });
    return Promise.resolve({ conversationId: "saved-chat", messageId: "saved-answer", response });
  });
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    textarea.value = "Please help me choose.";
    Simulate.change(textarea, { target: textarea } as any);
  });
  await act(async () => (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click());
  expect(host.textContent).toContain("Your latest saved answer.");
  // No extra request while chatting; the saved snapshot is refreshed on return.
  expect(mockAPI).not.toHaveBeenCalledWith("/api/coach/bootstrap");
  await act(async () => {
    const button = label
      ? [...host.querySelectorAll("button")].find(button => button.textContent === `Open ${label}`)!
      : host.querySelector('[aria-label="Go back"]') as HTMLButtonElement;
    button.click();
  });
  expect(mockNavigate).toHaveBeenCalledWith(route);
  act(() => root.render(null));
  (Element.prototype.scrollTo as jest.Mock).mockClear();
  await act(async () => root.render(<QueryClientProvider client={client}><CoachsCorner /></QueryClientProvider>));
  expect(mockAPI).toHaveBeenCalledWith("/api/coach/bootstrap");
  expect(host.querySelector("textarea")?.disabled).toBe(true); // Don't send with an unrestored conversation ID.
  await act(async () => {
    resolveBootstrap({
    profileCompleted: false, profile: null, conversationId: "saved-chat", hasOlderMessages: false,
    messages: [
      { id: "saved-question", role: "user", content: "Please help me choose.", created_at: "2026-01-01" },
      { id: "saved-answer", role: "coach", structured_payload: response, created_at: "2026-01-02" },
    ],
    });
  });
  expect(host.textContent).toContain("Please help me choose.");
  expect(host.textContent).toContain("Your latest saved answer.");
  if (label) expect(host.textContent).toContain(`Open ${label}`);
  expect(host.querySelector("textarea")?.disabled).toBe(false);
  expect(host.querySelector('[data-testid="ask-chef-composer"]')).not.toBeNull();
  expect(Element.prototype.scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "auto" }));
  // A later profile/background refetch must not reset the mounted conversation.
  (Element.prototype.scrollTo as jest.Mock).mockClear();
  act(() => client.setQueryData(["/api/coach/bootstrap"], (previous: any) => ({ ...previous, profile: { refreshed: true } })));
  expect(host.textContent).toContain("Your latest saved answer.");
  expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
});

test("historical assessment entry component redirects straight to conversation", () => {
  act(() => root.render(<ChefConversationEntry />));
  expect(mockNavigate).toHaveBeenCalledWith("/coach-corner/home");
  expect(host.textContent).toBe("");
});

test("failed return-time history loading is explicit and retry restores the saved conversation", async () => {
  await renderPage(false, [{ id: "saved-user", role: "user", content: "My saved question.", created_at: "2026-01-01" }]);
  const saved = client.getQueryData(["/api/coach/bootstrap"]);
  act(() => root.render(null));
  await client.invalidateQueries({ queryKey: ["/api/coach/bootstrap"], refetchType: "none" });
  mockAPI.mockRejectedValueOnce(Object.assign(new Error("History temporarily unavailable"), { status: 403 }));
  await act(async () => root.render(<QueryClientProvider client={client}><CoachsCorner /></QueryClientProvider>));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("saved messages have not been cleared");
  expect(host.querySelector("textarea")?.disabled).toBe(true);
  expect(host.textContent).not.toContain("What can I help you with?");
  mockAPI.mockResolvedValueOnce(saved);
  await act(async () => [...host.querySelectorAll("button")].find(button =>
    button.textContent === "Retry loading conversation")!.click());
  expect(host.textContent).toContain("My saved question.");
  expect(host.querySelector("textarea")?.disabled).toBe(false);
});

test("Development Back goes directly to Dashboard without scrolling or using browser history", async () => {
  await renderPage(false);
  const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
  (Element.prototype.scrollIntoView as jest.Mock).mockClear();
  (Element.prototype.scrollTo as jest.Mock).mockClear();
  act(() => (host.querySelector('[aria-label="Go back"]') as HTMLButtonElement).click());
  expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  expect(back).not.toHaveBeenCalled();
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
  back.mockRestore();
});

test("composer is outside the bounded message scroller with safe-area spacing", async () => {
  await renderPage(false);
  const pane = host.querySelector('[data-testid="ask-chef-pane"]')!;
  const history = host.querySelector('[data-testid="ask-chef-history"]')!;
  const composer = host.querySelector('[data-testid="ask-chef-composer"]')!;
  expect(pane.className).toContain("fixed inset-0");
  expect(pane.className).toContain("overflow-hidden");
  expect(history.className).toContain("min-h-0 overflow-y-auto");
  expect(history.contains(composer)).toBe(false);
  expect(composer.parentElement).toBe(history.parentElement);
  expect(composer.className).toContain("shrink-0");
  expect(composer.getAttribute("style")).toContain("safe-area-inset-bottom");
  expect(host.querySelector("textarea")?.placeholder).toBe("Ask Chef anything…");
  // The existing Development controls occupy the mobile top-right corner.
  expect(host.querySelector("h1")?.parentElement?.className).toContain("pr-28 lg:pr-4");
});

test("Production retains the existing layout, placeholder and history Back behavior", async () => {
  mockConversationEnabled = false;
  await renderPage(true);
  expect(host.querySelector('[data-testid="ask-chef-pane"]')).toBeNull();
  expect(host.querySelector("textarea")?.placeholder).toBe("Ask Coach anything…");
  const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
  act(() => (host.querySelector('[aria-label="Go back"]') as HTMLButtonElement).click());
  expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
  back.mockRestore();
});

test("keyboard viewport changes bound the pane and listeners are cleaned up", async () => {
  const oldDescriptor = Object.getOwnPropertyDescriptor(window, "visualViewport");
  const viewport = Object.assign(new EventTarget(), { height: window.innerHeight - 260, offsetTop: 0 });
  const remove = jest.spyOn(viewport, "removeEventListener");
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  try {
    await renderPage(false);
    const pane = host.querySelector('[data-testid="ask-chef-pane"]') as HTMLElement;
    expect(pane.style.bottom).toBe("260px");
    act(() => { viewport.height = window.innerHeight; viewport.dispatchEvent(new Event("resize")); });
    expect(pane.style.bottom).toBe("0px");
    act(() => root.render(null));
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  } finally {
    if (oldDescriptor) Object.defineProperty(window, "visualViewport", oldDescriptor);
    else delete (window as any).visualViewport;
  }
});

test("sending follows the newest exchange, but an arriving reply respects intentional history review", async () => {
  await renderPage(false);
  const history = host.querySelector('[data-testid="ask-chef-history"]') as HTMLElement;
  Object.defineProperties(history, {
    scrollHeight: { configurable: true, value: 2000 },
    clientHeight: { configurable: true, value: 400 },
  });
  history.scrollTop = 100;
  act(() => Simulate.scroll(history));
  let finish!: (value: any) => void;
  mockAPI.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    textarea.value = "My question";
    Simulate.change(textarea, { target: textarea } as any);
  });
  (Element.prototype.scrollTo as jest.Mock).mockClear();
  await act(async () => (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click());
  expect(Element.prototype.scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: "auto" });
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  history.scrollTop = 100;
  act(() => Simulate.scroll(history));
  (Element.prototype.scrollTo as jest.Mock).mockClear();
  await act(async () => finish({
    conversationId: "conversation", messageId: "reply",
    response: { presentation: { kind: "concierge", message: "Here is your reply." } },
  }));
  expect(host.textContent).toContain("Here is your reply.");
  expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
  expect(host.querySelector("textarea")).not.toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("Clear removes the conversation without navigating away", async () => {
  await renderPage(false, [{ id: "old", role: "user", content: "Old question", created_at: "2026-01-01" }]);
  mockAPI.mockImplementation(async (path: string) => path === "/api/coach/bootstrap"
    ? { profileCompleted: false, conversationId: null, messages: [], hasOlderMessages: false }
    : { success: true });
  act(() => (host.querySelector('[aria-label="Clear conversation"]') as HTMLButtonElement).click());
  const confirm = [...host.querySelectorAll("button")].filter(button => button.textContent === "Clear").at(-1)!;
  await act(async () => confirm.click());
  expect(mockAPI).toHaveBeenCalledWith("/api/coach/conversation/stored-conversation", { method: "DELETE" });
  expect(host.textContent).not.toContain("Old question");
  expect(host.querySelector("textarea")?.disabled).toBe(false);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("voice populates editable input and normal Send submits it", async () => {
  await renderPage(false);
  act(() => (host.querySelector('[aria-label="Use voice input for Ask Chef"]') as HTMLButtonElement).click());
  expect(host.querySelector("textarea")?.value).toBe("Voice-entered question");
  expect(mockAPI).not.toHaveBeenCalled();
  mockAPI.mockResolvedValueOnce({ conversationId: "voice", messageId: "answer",
    response: { presentation: { kind: "concierge", message: "Your answer." } } });
  await act(async () => (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click());
  expect(mockAPI).toHaveBeenCalledWith("/api/coach/message", expect.objectContaining({
    body: JSON.stringify({ message: "Voice-entered question", specialization: "corner" }),
  }));
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
      presentation: { kind: "concierge", message: "Let's use Create a Dish.", destinationId: "create_a_dish",
        navigation: approvedNavigation("create_a_dish"), creatorRequest },
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
    response: { presentation: { kind: "concierge", message: "Let's use Beverage Creator.", destinationId: "beverage_creator",
      navigation: approvedNavigation("beverage_creator") },
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
