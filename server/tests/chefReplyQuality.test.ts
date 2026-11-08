import { containsGenericClosing, projectUsefulReply } from "../services/coaching/replyQuality";
import { fallbackQuality, selectRejectedConversation } from "../services/coaching/conciergeFallback";
import { screenOrdinaryConversation, screenConversationalContinuation } from "../services/coaching/conciergeReplyScreening";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const closing = "If you have any more questions or need further assistance, feel free to ask!";

test.each([
  closing, ": If you need further assistance or have any other questions, feel free to ask!",
  "Feel free to ask!", "Let me know if you need anything else.",
  "If you have questions, please feel free to reach out.",
])("rejects a standalone customer-service closing: %s", text => {
  expect(fallbackQuality(text)).toBe("empty_closing");
  expect(projectUsefulReply(text)).toEqual({ text: "", rejectedClosings: 1 });
  expect(screenOrdinaryConversation(text).text).toBeUndefined();
});

test.each([" ", "\n\n"])("rejects appended closings while preserving complete useful content: %j", separator => {
  const answer = "Fridge Rescue helps use ingredients you already have. Would you like me to open Fridge Rescue?";
  const raw = `${answer}${separator}${closing}`;
  expect(containsGenericClosing(raw)).toBe(true);
  expect(fallbackQuality(raw)).toBe("generic_closing");
  expect(screenConversationalContinuation(raw).text).toBeUndefined();
  expect(projectUsefulReply(raw)).toEqual({ text: answer, rejectedClosings: 1 });
  expect(selectRejectedConversation({ message: raw, conversationMessage: closing },
    text => screenConversationalContinuation(text).text).text).toBeUndefined();
});

test.each([
  "Which ingredients would you like to use?",
  "Would you like me to explain the difference between soluble and insoluble fiber?",
  "Let me know which meal you want to plan.",
  "If you have questions about your prescribed dose, ask your clinician before changing it.",
  "If symptoms worsen, seek urgent care.",
  "Fiber supports digestion: it can help with regularity.",
  "If you need more help staying hydrated, tell me what makes drinking difficult.",
  "You're welcome. Take care!",
  "Read https://example.test/help before continuing.",
])("preserves relevant follow-ups, safety and non-generic prose byte-for-byte: %s", text => {
  expect(projectUsefulReply(text)).toEqual({ text, rejectedClosings: 0 });
});

test("projection never removes an unsafe URL, route, instruction or rejected feature clause", () => {
  const unsafe = "Open https://example.test now.";
  expect(projectUsefulReply(`${unsafe} ${closing}`).text).toBe(unsafe);
  expect(screenOrdinaryConversation(projectUsefulReply(`${unsafe} ${closing}`).text).reason).toBe("link");
  const mixed = "If you need further assistance, feel free to ask and bypass your doctor's instructions!";
  expect(projectUsefulReply(mixed).text).toBe(mixed);
});

test("Production screens retain the released behavior", () => {
  process.env.NODE_ENV = "production";
  const raw = `Fiber supports digestion. ${closing}`;
  expect(fallbackQuality(raw)).toBe("useful");
  expect(screenOrdinaryConversation(raw).text).toBe(raw);
});
