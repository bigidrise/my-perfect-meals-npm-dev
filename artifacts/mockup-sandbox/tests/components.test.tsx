import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AdvisorPanel } from "../src/pairing-advisor/AdvisorPanel";
import { Composer, ResponseView } from "../src/pairing-advisor/components/AdvisorComponents";
import { createAdvisorState } from "../src/pairing-advisor/model";
import { syntheticResponse } from "../src/pairing-advisor/fixtures";
import type { AdvisorResponse } from "../../../shared/pairingAdvisor/contracts";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
function sample(outcome: "education" | "recommendation" | "clarification" | "restricted" | "unavailable"): AdvisorResponse {
  return syntheticResponse({
    accountId: "synthetic-a", workspaceId: null, conversationId: "sample", contextRevision: 0, requestId: "sample-request",
  }, createAdvisorState().context, "", outcome) as AdvisorResponse;
}
test("freeform composer is available immediately, with synthetic disclosure and no required questionnaire", () => {
  render(<AdvisorPanel />);
  expect(screen.getByRole("textbox", { name: "Your message" })).toBeTruthy();
  expect(screen.getByText(/No live AI or customer data/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send message" }).hasAttribute("disabled")).toBe(true);
  expect(document.querySelectorAll("input[required],textarea[required],select[required]")).toHaveLength(0);
  expect(document.querySelectorAll(".advisor-context-details[open]")).toHaveLength(0);
  expect(document.querySelectorAll(".advisor-rec-card")).toHaveLength(0);
});
test("optional question shortcuts populate the draft rather than submitting", () => {
  render(<AdvisorPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Show a sample pairing" }));
  expect((screen.getByRole("textbox", { name: "Your message" }) as HTMLTextAreaElement).value).toBe("Show a sample pairing");
  expect(screen.queryByLabelText("Stop response")).toBeNull();
});
test("typed submission waits for the entire response, then shows validated cards", () => {
  render(<AdvisorPanel />);
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Show a sample pairing" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByRole("button", { name: "Stop response" })).toBeTruthy();
  expect(document.querySelectorAll(".advisor-rec-card")).toHaveLength(0);
  act(() => jest.advanceTimersByTime(700));
  expect(document.querySelectorAll(".advisor-rec-card")).toHaveLength(2);
  expect(screen.queryByLabelText("Stop response")).toBeNull();
});
test.each(["education", "recommendation", "clarification", "restricted", "unavailable"] as const)("explicit %s outcome is readable and not confused with recommendation cards", outcome => {
  render(<ResponseView response={sample(outcome)} historical={false} setDraft={jest.fn()} />);
  expect(document.querySelector(".advisor-response-label")?.textContent?.toLowerCase()).toContain(outcome);
  expect(document.querySelectorAll(".advisor-rec-card")).toHaveLength(outcome === "recommendation" ? 2 : 0);
});
test("historical recommendation controls are disabled", () => {
  render(<ResponseView response={sample("recommendation")} historical setDraft={jest.fn()} />);
  expect(screen.getByText(/recommendations are historical/)).toBeTruthy();
  for (const button of screen.getAllByRole("button")) expect(button.hasAttribute("disabled")).toBe(true);
});
test("list replacement and reset require confirmation, and cancel preserves state", () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  render(<AdvisorPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Load synthetic sample list" }));
  const supplied = (screen.getByLabelText("Paste list entries") as HTMLTextAreaElement).value;
  fireEvent.change(screen.getByLabelText("Paste list entries"), { target: { value: "Replacement synthetic list" } });
  fireEvent.click(screen.getByRole("button", { name: "Replace supplied list" }));
  expect(confirm).toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Retained draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Start over" }));
  expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toBe("Retained draft");
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Start over" }));
  expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toBe("");
  expect((screen.getByLabelText("Paste list entries") as HTMLTextAreaElement).value).toBe("");
  expect(supplied).toContain("Test Cellar");
  confirm.mockRestore();
});
test("context editing marks prior recommendations historical", () => {
  render(<AdvisorPanel />);
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Show a sample pairing" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  act(() => jest.advanceTimersByTime(700));
  fireEvent.change(screen.getByLabelText("Sauce"), { target: { value: "User-described sauce" } });
  fireEvent.blur(screen.getByLabelText("Sauce"));
  expect(screen.getByText(/recommendations are historical/)).toBeTruthy();
});
test("identity switch immediately clears the draft and transcript", () => {
  render(<AdvisorPanel />);
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Private synthetic draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Switch" }));
  expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toBe("");
  expect(screen.getByText(/Sample diner B/)).toBeTruthy();
});
test("unrelated context editing preserves a supplied-list draft until explicit submission or reset", () => {
  render(<AdvisorPanel />);
  fireEvent.change(screen.getByLabelText("Paste list entries"), { target: { value: "Unsaved synthetic list" } });
  fireEvent.change(screen.getByLabelText("Meal"), { target: { value: "Synthetic meal" } });
  fireEvent.blur(screen.getByLabelText("Meal"));
  expect((screen.getByLabelText("Paste list entries") as HTMLTextAreaElement).value).toBe("Unsaved synthetic list");
  fireEvent.click(screen.getByRole("button", { name: "Switch" }));
  expect((screen.getByLabelText("Paste list entries") as HTMLTextAreaElement).value).toBe("");
});
test("Enter submits, Shift+Enter and IME composition do not", () => {
  const send = jest.fn();
  render(<Composer draft="A question" setDraft={jest.fn()} send={send} waiting={false}
    stop={jest.fn()} retry={jest.fn()} status="ready" lastQuestion={null} />);
  const input = screen.getByLabelText("Your message");
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(send).toHaveBeenCalledTimes(1);
});
test("stop, unavailable and retry controls remain keyboard-addressable", () => {
  render(<AdvisorPanel />);
  fireEvent.change(screen.getByLabelText("Response scenario"), { target: { value: "invalid" } });
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Question" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  screen.getByRole("button", { name: "Stop response" }).focus();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stop response" }));
  act(() => jest.advanceTimersByTime(700));
  expect(document.querySelectorAll(".advisor-rec-card")).toHaveLength(0);
  const retry = screen.getByRole("button", { name: "Retry question" });
  retry.focus();
  expect(document.activeElement).toBe(retry);
});
test("same recommendation IDs in different turns get unique DOM targets", () => {
  const first = sample("recommendation");
  render(<><ResponseView response={first} historical setDraft={jest.fn()} />
    <ResponseView response={{ ...first, requestId: "next-request" }} historical={false} setDraft={jest.fn()} /></>);
  const ids = Array.from(document.querySelectorAll(".advisor-rec-card")).map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
});
