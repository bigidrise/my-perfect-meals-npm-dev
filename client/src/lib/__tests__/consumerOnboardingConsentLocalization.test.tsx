/** @jest-environment jsdom */
import React from "react";
import { createHash } from "node:crypto";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import ConsumerWelcome from "@/pages/ConsumerWelcome";
import { NarrationBar } from "@/components/NarrationBar";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { approvedConsumerOnboardingSpanish } from "@/i18n/approvedConsumerOnboarding";

const mockNavigate = jest.fn();
const mockPlay = jest.fn();
const mockNarration = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/consumer-welcome", mockNavigate] }));
jest.mock("@/hooks/useNarration", () => ({
  useNarration: (...args: unknown[]) => mockNarration(...args),
}));

const normalized = (text: string) => text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
beforeEach(() => {
  jest.clearAllMocks();
  mockNarration.mockReturnValue({
    isPlaying: false, isPaused: false, currentSectionIndex: 0, totalSections: 1,
    play: mockPlay, pause: jest.fn(), resume: jest.fn(), stop: jest.fn(),
    reset: jest.fn(), skipBack10: jest.fn(), nextSection: jest.fn(),
  });
});

test("all 32 source/Spanish pairs exactly match the founder-approved comparison", () => {
  expect(Object.keys(approvedConsumerOnboardingSpanish)).toHaveLength(32);
  expect(createHash("sha256").update(JSON.stringify(Object.entries(approvedConsumerOnboardingSpanish))).digest("hex"))
    .toBe("5af6a721f633a5997fa09b37119787314547b812484110e65745c809d299dc95");
  for (const [english, spanish] of Object.entries(approvedConsumerOnboardingSpanish)) {
    expect(consumerEnglish[english]).toBe(english);
    expect(consumerSpanish[english]).toBe(spanish);
  }
});

test.each(["en", "es"])("%s renders all approved page sections and the correct narration script", async language => {
  await i18n.changeLanguage(language);
  render(<ConsumerWelcome />);
  const entries = Object.entries(approvedConsumerOnboardingSpanish);
  const sections = mockNarration.mock.calls.at(-1)![0];
  expect(sections).toEqual([{
    heading: language === "es" ? entries[0][1] : entries[0][0],
    text: language === "es" ? entries[1][1] : entries[1][0],
  }]);
  const body = normalized(document.body.textContent || "");
  for (const [english, spanish] of entries.slice(2)) {
    expect(body).toContain(normalized(language === "es" ? spanish : english));
  }
  expect(document.body.textContent).not.toContain("**");
  expect(screen.getByRole("button", { name: language === "es" ? "Escuchar" : "Listen" })).toBeInTheDocument();
  expect(mockPlay).not.toHaveBeenCalled();
});

test.each(["en", "es"])("%s preserves both independent requirements and the existing destination", async language => {
  await i18n.changeLanguage(language);
  render(<ConsumerWelcome />);
  const [read, accepted] = screen.getAllByRole("checkbox");
  const next = screen.getByRole("button", {
    name: language === "es" ? "Continuar con la configuración" : "Continue to Onboarding",
  });
  expect(next).toBeDisabled();
  fireEvent.click(next);
  expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.click(read);
  expect(next).toBeDisabled();
  fireEvent.click(read);
  fireEvent.click(accepted);
  expect(next).toBeDisabled();
  fireEvent.click(read);
  expect(next).toBeEnabled();
  fireEvent.click(accepted);
  expect(next).toBeDisabled();
  fireEvent.click(accepted);
  fireEvent.click(next);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
});

test("changing display language preserves consent state and refreshes the narration script", async () => {
  await i18n.changeLanguage("en");
  render(<ConsumerWelcome />);
  const [read, accepted] = screen.getAllByRole("checkbox");
  fireEvent.click(read);
  fireEvent.click(accepted);
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getAllByRole("checkbox").every(box => box.getAttribute("aria-checked") === "true")).toBe(true);
  expect(screen.getByRole("button", { name: "Continuar con la configuración" })).toBeEnabled();
  expect(mockNarration.mock.calls.at(-1)![0][0].heading).toBe("Una breve introducción de Chef");
});

test("shared narration controls keep their existing wording when page-owned labels are omitted", async () => {
  await i18n.changeLanguage("es");
  render(<NarrationBar sections={[{ heading: "Existing authored content" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  expect(mockPlay).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Transcript" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start Over" })).toBeInTheDocument();
});
