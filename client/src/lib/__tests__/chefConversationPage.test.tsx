/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CoachsCorner from "@/pages/CoachsCorner";
import ChefConversationEntry from "@/components/coaching/ChefConversationEntry";
import CoachBubble from "@/components/coaching/CoachBubble";
import { chefNavigationRoute } from "@shared/coaching/creatorRequest";

let mockConversationEnabled = true;
let mockReliabilityEnabled = false;
let mockTurnSequence = 0;
const mockNavigate = jest.fn();
const mockAPI = jest.fn();
test.each([false, true])("care guidance renders once, including historical duplicated envelopes=%s", historical => {
  const guidance = "Call emergency services now for these symptoms.";
  const structured = {
    whatIFound: historical ? guidance : "",
    whatItCouldMean: historical ? guidance : "",
    todayPlan: { why: "", items: [{ kind: "contact_care", text: guidance }],
      successMetric: "", nextCheckIn: "" },
    learningOpportunity: null, meta: { redFlag: true },
  };
  act(() => root.render(<CoachBubble structured={structured} enableConcierge />));
  expect(host.textContent?.split(guidance)).toHaveLength(2);
  expect(host.textContent).not.toContain("These are suggestions");
  expect(host.querySelector("button")).toBeNull();
});

test("ordinary conversation has neither care template nor professional boilerplate", () => {
  act(() => root.render(<CoachBubble enableConcierge structured={{
    presentation: { kind: "concierge", message: "Do you want to make it or buy it?" },
    whatIFound: "", whatItCouldMean: "", todayPlan: null, learningOpportunity: null,
  }} />));
  expect(host.textContent).toContain("Do you want to make it or buy it?");
  expect(host.textContent).not.toMatch(/Your safety comes first|I noticed something|These are suggestions/);
});

const approvedNavigation = (destinationId: string) => ({
  state: "navigation_confirmed", destinationId,
  goal: { activity: "unknown", occasion: "unknown", restaurant: "unknown", dishChosen: false,
    specialty: "none", explicitFeatureId: null },
});
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => mockConversationEnabled }));
jest.mock("@/lib/chefConversationReliabilityGate", () => ({
  isChefConversationReliabilityEnabled: () => mockReliabilityEnabled,
  isChefFeatureScreenContextEnabled: () => false,
}));
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
  mockConversationEnabled = true; mockReliabilityEnabled = false; mockNavigate.mockReset(); mockAPI.mockReset();
  mockTurnSequence = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++mockTurnSequence).padStart(12, "0")}` });
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

function deferredReply() {
  let resolve!: (value: any) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function replyFor(turnId: string, message = "Matched reply", conversationId = "reliable-conversation") {
  return { clientTurnId: turnId, conversationId, messageId: `assistant-${turnId}`,
    response: { presentation: { kind: "concierge", message }, whatIFound: message,
      whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null } };
}
function postedTurns() {
  return mockAPI.mock.calls.filter(([url]) => url === "/api/coach/message")
    .map(([, options]) => JSON.parse(options.body));
}

test.each([true, false])("meal-prep conversation renders actual builder actions and rechecks access on click, allowed=%s", async allowed => {
  await renderPage(false);
  const goal = { activity: "plan_meals", occasion: "unknown", restaurant: "unknown",
    dishChosen: false, specialty: "none", explicitFeatureId: "meal_builders" };
  const messages = [
    ["Help me get started", "Would you like help planning meals, preparing a dish, or shopping?"],
    ["Meal prep", "Are you planning meals ahead, cooking a specific dish, or shopping?"],
    ["Meal builder", "Use the Open Meal Builders button, then open your assigned builder."],
    ["Where is my builder?", "Use the Open Meal Builders button to reach the landing page."],
  ];
  for (const [index, [input, answer]] of messages.entries()) {
    mockAPI.mockResolvedValueOnce({ conversationId: "builder-conversation", messageId: `builder-${index}`,
      response: { presentation: { kind: "concierge", message: answer,
        ...(index >= 2 ? { destinationId: "meal_builders", navigation: {
          state: "direct_navigation", destinationId: "meal_builders", goal,
        } } : {}) },
        whatIFound: answer, whatItCouldMean: "", learningOpportunity: null,
        todayPlan: { items: index >= 2 ? [{ kind: "use_feature", destinationId: "meal_builders" }] : [] } } });
    await act(async () => {
      const textarea = host.querySelector("textarea")!;
      textarea.value = input; Simulate.change(textarea, { target: textarea } as any);
    });
    await act(async () => { (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click(); });
    expect([...host.querySelectorAll("button")].filter(button => button.textContent === "Open Meal Builders"))
      .toHaveLength(Math.max(0, index - 1));
  }
  const button = [...host.querySelectorAll("button")].find(button => button.textContent === "Open Meal Builders")!;
  if (allowed) mockAPI.mockResolvedValueOnce({ destinationId: "meal_builders", route: "/builders" });
  else mockAPI.mockRejectedValueOnce(new Error("403 access changed"));
  await act(async () => button.click());
  expect(mockAPI).toHaveBeenLastCalledWith("/api/coach/navigation", expect.objectContaining({
    method: "POST", body: JSON.stringify({ destinationId: "meal_builders" }),
  }));
  if (allowed) expect(mockNavigate).toHaveBeenCalledWith("/builders");
  else {
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("not included in your current access");
  }
});
async function submitReliable(text: string) {
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    textarea.value = text;
    Simulate.change(textarea, { target: textarea } as any);
  });
  await act(async () => (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click());
}

test("Development synchronously excludes same-frame and pending overlapping sends and uses the visible text", async () => {
  mockReliabilityEnabled = true;
  const pending = deferredReply();
  mockAPI.mockReturnValue(pending.promise);
  await renderPage(false);
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    // Deliberately do not dispatch change: visible DOM is newer than React state.
    textarea.value = "Thanks, that's all I needed.";
    Simulate.keyDown(textarea, { key: "Enter" });
    Simulate.keyDown(textarea, { key: "Enter" });
  });
  expect(postedTurns()).toHaveLength(1);
  expect(postedTurns()[0].message).toBe("Thanks, that's all I needed.");
  await act(async () => Simulate.keyDown(host.querySelector("textarea")!, { key: "Enter" }));
  expect(postedTurns()).toHaveLength(1);
  await act(async () => pending.resolve(replyFor(postedTurns()[0].clientTurnId)));
  expect(host.textContent).toContain("Matched reply");
  expect(host.querySelector("textarea")!.disabled).toBe(false);
});

test.each(["Network failure", "500: Unavailable", "400: Invalid request", "409: Turn in progress"])(
  "Development does not inherit POST retries after %s and permits an explicit next turn", async failure => {
    mockReliabilityEnabled = true;
    client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: 2, retryDelay: 0 } });
    mockAPI.mockRejectedValueOnce(new Error(failure));
    await renderPage(false);
    await submitReliable("First question");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(postedTurns()).toHaveLength(1);
    expect(host.textContent).toContain("I ran into a problem");
    expect(host.querySelector("textarea")!.disabled).toBe(false);
    mockAPI.mockImplementationOnce(async (_url, options) =>
      replyFor(JSON.parse(options.body).clientTurnId, "Second turn reply"));
    await submitReliable("Second question");
    expect(postedTurns()).toHaveLength(2);
    expect(postedTurns()[1].clientTurnId).not.toBe(postedTurns()[0].clientTurnId);
    expect(host.textContent).toContain("Second turn reply");
    expect(host.textContent!.indexOf("First question")).toBeLessThan(host.textContent!.indexOf("I ran into a problem"));
    expect(host.textContent!.indexOf("I ran into a problem")).toBeLessThan(host.textContent!.indexOf("Second question"));
    expect(host.textContent!.indexOf("Second question")).toBeLessThan(host.textContent!.indexOf("Second turn reply"));
  },
);

test.each(["wrong_turn", "missing_turn", "wrong_conversation"])(
  "Development rejects a %s response without displaying it", async mismatch => {
    mockReliabilityEnabled = true;
    await renderPage(false, [{ id: "stored-user", role: "user", content: "Earlier question",
      structured_payload: null, created_at: "2026-01-01T00:00:00Z" }]);
    mockAPI.mockImplementationOnce(async (_url, options) => {
      const result = replyFor(JSON.parse(options.body).clientTurnId, "UNMATCHED_RESPONSE",
        mismatch === "wrong_conversation" ? "different-conversation" : "stored-conversation");
      if (mismatch === "wrong_turn") result.clientTurnId = "another-turn";
      if (mismatch === "missing_turn") delete (result as any).clientTurnId;
      return result;
    });
    await submitReliable("Current question");
    expect(host.textContent).not.toContain("UNMATCHED_RESPONSE");
    expect(host.textContent).toContain("I ran into a problem");
    expect(host.querySelector("textarea")!.disabled).toBe(false);
    expect(postedTurns()).toHaveLength(1);
  },
);

test.each(["success", "failure"])("a late %s from an unmounted conversation cannot affect the new turn", async outcome => {
  mockReliabilityEnabled = true;
  const old = deferredReply();
  const current = deferredReply();
  mockAPI.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  await renderPage(false);
  await submitReliable("Old member turn");
  const oldTurn = postedTurns()[0].clientTurnId;
  await act(async () => root.render(<div>Left the conversation</div>));
  await renderPage(false);
  await submitReliable("New member turn");
  const currentTurn = postedTurns()[1].clientTurnId;
  await act(async () => {
    if (outcome === "success") old.resolve(replyFor(oldTurn, "STALE_REPLY"));
    else old.reject(new Error("Late failure"));
  });
  expect(host.textContent).not.toMatch(/STALE_REPLY|I ran into a problem/);
  expect(host.querySelector("textarea")!.disabled).toBe(true);
  await act(async () => current.resolve(replyFor(currentTurn, "Current matched reply")));
  expect(host.textContent).toContain("Current matched reply");
  expect(host.querySelector("textarea")!.disabled).toBe(false);
});

test("Development IME composition Enter does not submit an unfinished message", async () => {
  mockReliabilityEnabled = true;
  await renderPage(false);
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    textarea.value = "Still composing";
    Simulate.change(textarea, { target: textarea } as any);
  });
  await act(async () => {
    const textarea = host.querySelector("textarea")!;
    Simulate.keyDown(textarea, { key: "Enter", nativeEvent: { isComposing: true } } as any);
  });
  expect(postedTurns()).toHaveLength(0);
  expect(host.querySelector("textarea")!.value).toBe("Still composing");
});

test("Development carries the confirmed conversation ID into the next matched turn", async () => {
  mockReliabilityEnabled = true;
  mockAPI.mockImplementation(async (_url, options) => replyFor(JSON.parse(options.body).clientTurnId));
  await renderPage(false);
  await submitReliable("First turn");
  await submitReliable("Next turn");
  expect(postedTurns()[0].conversationId).toBeUndefined();
  expect(postedTurns()[1].conversationId).toBe("reliable-conversation");
});

test("the released non-Development send still inherits its existing retry behavior without a turn field", async () => {
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: 1, retryDelay: 0 } });
  mockAPI.mockRejectedValueOnce(new Error("500: Temporary"));
  mockAPI.mockResolvedValueOnce(replyFor("not-used", "Released reply"));
  await renderPage(false);
  await submitReliable("Released question");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(postedTurns()).toHaveLength(2);
  expect(postedTurns()[0].clientTurnId).toBeUndefined();
  expect(host.textContent).toContain("Released reply");
});

test("the four-turn small ice-cream conversation renders Open Craving Creator after the first yes", async () => {
  await renderPage(false);
  const goal = { activity: "prepare", occasion: "snack", restaurant: "unknown",
    dishChosen: false, specialty: "none", explicitFeatureId: null };
  const question = "Would you like to open the Craving Creator to make a small portion of ice cream?";
  const handoff = "To begin making your small portion of ice cream, open the Craving Creator and describe your craving.";
  const turns = [
    { input: "I want some ice cream.", message: "Are you looking to buy some ice cream from the store, or are you interested in making your own ice cream at home?" },
    { input: "make it myself", message: "You can use Craving Creator for a small portion or Dessert Creator for a larger batch. Would you like a small portion or larger dessert recipe?" },
    { input: "small", message: question },
    { input: "yes", message: handoff },
  ];
  for (const [index, turn] of turns.entries()) {
    mockAPI.mockResolvedValueOnce({ conversationId: "craving-conversation", messageId: `craving-${index}`,
      response: { presentation: { kind: "concierge", message: turn.message,
        ...(index === 2 ? { navigation: { state: "recommendation_pending", destinationId: "craving_creator", goal } } : {}),
        ...(index === 3 ? { destinationId: "craving_creator", navigation: {
          state: "navigation_confirmed", destinationId: "craving_creator", goal,
        } } : {}) },
        whatIFound: "", whatItCouldMean: "", meta: { redFlag: false }, learningOpportunity: null,
        todayPlan: { items: index === 3 ? [{ kind: "use_feature", destinationId: "craving_creator" }] : [] } } });
    await act(async () => {
      const textarea = host.querySelector("textarea")!;
      textarea.value = turn.input;
      Simulate.change(textarea, { target: textarea } as any);
    });
    await act(async () => { (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click(); });
    const buttons = [...host.querySelectorAll("button")].filter(button => button.textContent === "Open Craving Creator");
    expect(buttons).toHaveLength(index === 3 ? 1 : 0);
    expect(host.textContent).toContain(turn.message);
    expect(mockNavigate).not.toHaveBeenCalled();
  }
  expect(mockAPI).toHaveBeenCalledTimes(4);
  const button = [...host.querySelectorAll("button")].find(button => button.textContent === "Open Craving Creator")!;
  mockAPI.mockResolvedValueOnce({ destinationId: "craving_creator", route: chefNavigationRoute("craving_creator") });
  await act(async () => button.click());
  expect(mockAPI).toHaveBeenLastCalledWith("/api/coach/navigation", expect.objectContaining({
    method: "POST", body: JSON.stringify({ destinationId: "craving_creator" }),
  }));
  expect(mockNavigate).toHaveBeenCalledWith(chefNavigationRoute("craving_creator"));
  expect(mockAPI).toHaveBeenCalledTimes(5);
});

test("restaurant recommendation followed by one yes displays the real validated navigation control", async () => {
  await renderPage(false);
  const send = async (message: string) => {
    await act(async () => {
      const textarea = host.querySelector("textarea")!;
      textarea.value = message;
      Simulate.change(textarea, { target: textarea } as any);
    });
    await act(async () => { (host.querySelector('[aria-label="Send message"]') as HTMLButtonElement).click(); });
  };
  const goal = { activity: "eat_out", occasion: "dessert", restaurant: "not_chosen",
    dishChosen: false, specialty: "none", explicitFeatureId: null };
  const question = "Find Meals Near Me searches nearby restaurants. Would you like to open it?";
  mockAPI.mockResolvedValueOnce({ conversationId: "restaurant-conversation", messageId: "restaurant-offer",
    response: { presentation: { kind: "concierge", message: question,
      navigation: { state: "recommendation_pending", destinationId: "find_meals_near_me", goal } },
      whatIFound: "", whatItCouldMean: "", todayPlan: { items: [] }, learningOpportunity: null } });
  await send("I wanna go to a restaurant to get ice cream.");
  expect(host.textContent).toContain(question);
  expect([...host.querySelectorAll("button")].filter(button => button.textContent === "Open Find Meals Near Me")).toHaveLength(0);
  const instructions = "Follow the guided flow, describe your craving, and enter a ZIP code or use the location control.";
  mockAPI.mockResolvedValueOnce({ conversationId: "restaurant-conversation", messageId: "restaurant-handoff",
    response: { presentation: { kind: "concierge", message: instructions, destinationId: "find_meals_near_me",
      navigation: { state: "navigation_confirmed", destinationId: "find_meals_near_me", goal } },
      whatIFound: "", whatItCouldMean: "", todayPlan: { items: [{ kind: "use_feature", destinationId: "find_meals_near_me" }] },
      learningOpportunity: null } });
  await send("yes");
  const buttons = [...host.querySelectorAll("button")].filter(button => button.textContent === "Open Find Meals Near Me");
  expect(buttons).toHaveLength(1);
  expect(host.textContent).toContain(instructions);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockAPI).toHaveBeenCalledTimes(2);
  mockAPI.mockResolvedValueOnce({ destinationId: "find_meals_near_me", route: chefNavigationRoute("find_meals_near_me") });
  await act(async () => buttons[0].click());
  expect(mockAPI).toHaveBeenLastCalledWith("/api/coach/navigation", expect.objectContaining({
    method: "POST", body: JSON.stringify({ destinationId: "find_meals_near_me" }),
  }));
  expect(mockNavigate).toHaveBeenCalledWith(chefNavigationRoute("find_meals_near_me"));
});

test.each([false, true])("actual chat page is immediately usable with assessment completion=%s", async completed => {
  await renderPage(completed);
  const textarea = host.querySelector("textarea")!;
  expect(textarea).not.toBeNull();
  expect(textarea.disabled).toBe(false);
  expect(host.querySelectorAll("h2")).toHaveLength(1);
  expect(host.querySelector("h2")?.textContent?.trim()).toBe("How can I help you today?");
  expect(host.textContent).toContain("Ask about nutrition or anything in My Perfect Meals.");
  expect(textarea.placeholder).toBe("Ask me anything...");
  expect(host.textContent).not.toMatch(/What's on your mind|What can I help you with/);
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
  expect(host.textContent).not.toContain("How can I help you today?");
  expect(host.textContent).not.toContain("Ask about nutrition or anything in My Perfect Meals.");
  expect(host.querySelector("textarea")?.placeholder).toBe("Ask me anything...");
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
  expect(host.textContent).not.toContain("How can I help you today?");
  expect(host.textContent).not.toMatch(/Edit profile|Retake full assessment/);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test.each([
  ["grocery_find_product", "Find a Product"],
  ["grocery_create_meal", "Create a Meal"],
  ["grocery_create_meal", "Build a Meal"],
])("%s opens Grocery Store Coach while preserving the %s explanation", async (destinationId, functionName) => {
  const explanation = `Open Grocery Store Coach and select ${functionName}.`;
  await renderPage(false, [{
    id: "grocery-guidance", role: "assistant", created_at: "2026-01-01T00:00:00Z",
    structured_payload: {
      presentation: { kind: "concierge", message: explanation,
        destinationId, navigation: approvedNavigation(destinationId) },
      whatIFound: "", whatItCouldMean: "",
      todayPlan: { items: [{ kind: "use_feature", destinationId }] }, learningOpportunity: null,
    },
  }]);
  expect(host.textContent).toContain(explanation);
  const buttons = [...host.querySelectorAll("button")];
  const open = buttons.find(button => button.textContent === "Open Grocery Store Coach");
  expect(open).toBeDefined();
  expect(buttons.some(button => button.textContent === `Open ${functionName}`)).toBe(false);
  expect(mockAPI).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  mockAPI.mockResolvedValueOnce({ destinationId, route: "/shopping-list-v2" });
  await act(async () => open!.click());
  expect(mockAPI).toHaveBeenCalledTimes(1);
  expect(mockAPI).toHaveBeenCalledWith("/api/coach/navigation", {
    method: "POST", body: JSON.stringify({ destinationId }),
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith("/shopping-list-v2");
  expect(host.textContent).toContain(explanation);
});

test.each([
  ["restaurant_guide", "Restaurant Assistant", "/social-hub/restaurant-guide"],
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
  expect(host.querySelector("textarea")?.placeholder).toBe("Ask me anything...");
  // The existing Development controls occupy the mobile top-right corner.
  expect(host.querySelector("h1")?.parentElement?.className).toContain("pr-28 lg:pr-4");
});

test("Production retains the existing layout, placeholder and history Back behavior", async () => {
  mockConversationEnabled = false;
  await renderPage(true);
  expect(host.querySelector('[data-testid="ask-chef-pane"]')).toBeNull();
  expect(host.querySelector("textarea")?.placeholder).toBe("Ask me anything...");
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
