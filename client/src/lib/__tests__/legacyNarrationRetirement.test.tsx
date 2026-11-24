/** @jest-environment jsdom */
import React, { useEffect } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { LEGACY_CHEF_NARRATION_ENABLED } from "@shared/legacyNarration";
import { LegacyNarration } from "@/components/LegacyNarration";
import { NarrationBar } from "@/components/NarrationBar";
import { ttsService } from "@/lib/tts";
import { voiceManager } from "@/voice/VoiceManager";
import { useChefVoice } from "@/lib/useChefVoice";
import { useChefVoice as useKitchenVoice } from "@/components/chefs-kitchen/useChefVoice";
import ConsumerWelcome from "@/pages/ConsumerWelcome";
import ProCareWelcome from "@/pages/procare/ProCareWelcome";
import ChefCoPilotWalkthrough from "@/components/kitchen/ChefCoPilotWalkthrough";

const mockNavigate = jest.fn();
let mockPath = "/consumer-welcome";
jest.mock("wouter", () => ({ useLocation: () => [mockPath, mockNavigate] }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => true }));
jest.mock("@/styles/entryReadabilityGate", () => ({ entryReadabilityClassName: "" }));

beforeEach(() => {
  mockNavigate.mockReset();
  localStorage.clear();
  global.fetch = jest.fn(() => { throw Error("Unexpected network in offline narration regression"); }) as any;
  jest.spyOn(window, "Audio").mockImplementation(() => {
    throw Error("Retired narration must not construct audio");
  });
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

test("the shared pause unmounts children and all NarrationBar controls without providers or effects", () => {
  expect(LEGACY_CHEF_NARRATION_ENABLED).toBe(false);
  const mounted = jest.fn();
  function LegacyChild() { useEffect(mounted, []); return <button>Listen</button>; }
  const { container } = render(<>
    <LegacyNarration><LegacyChild /></LegacyNarration>
    <NarrationBar sections={[{ heading: "Retained narration script" }]} />
  </>);
  expect(container).toBeEmptyDOMElement();
  expect(mounted).not.toHaveBeenCalled();
});

test("service, manager, warmup and general hook stay silent with exactly-once completion", async () => {
  const onEnd = jest.fn(), onStart = jest.fn();
  expect(await ttsService.speak("Legacy explanation", { onEnd, onStart }))
    .toEqual({ provider: "silent", success: true });
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onStart).not.toHaveBeenCalled();
  onEnd.mockClear();
  expect(await voiceManager.preload()).toBe(false);
  expect((await voiceManager.speak("Legacy explanation", onEnd)).status).toBe("silent");
  expect(onEnd).toHaveBeenCalledTimes(1);
  onEnd.mockClear();
  const { result } = renderHook(useChefVoice);
  await act(async () => { await result.current.preload(); await result.current.speak("Generating meals", onEnd); });
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(window.Audio).not.toHaveBeenCalled();
});

test("cooking's completion callback unlocks progression without TTS or playing state", async () => {
  const setPlaying = jest.fn(), unlockStep = jest.fn();
  const { result } = renderHook(() => useKitchenVoice(setPlaying));
  await act(async () => { await result.current.speak("Prepare the ingredients", unlockStep); });
  expect(unlockStep).toHaveBeenCalledTimes(1);
  expect(setPlaying).toHaveBeenCalledWith(false);
  expect(setPlaying).not.toHaveBeenCalledWith(true);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(window.Audio).not.toHaveBeenCalled();
});

test.each(["en", "es"])("%s Consumer Welcome keeps both acknowledgments and navigation without narration", async language => {
  await i18n.changeLanguage(language);
  render(<ConsumerWelcome />);
  expect(screen.queryByRole("button", { name: /Listen|Escuchar|Transcript|Transcrip/i })).not.toBeInTheDocument();
  const next = screen.getByRole("button", { name: language === "es" ? "Continuar con la configuración" : "Continue to Onboarding" });
  const [read, consent] = screen.getAllByRole("checkbox");
  expect(next).toBeDisabled();
  fireEvent.click(read);
  expect(next).toBeDisabled();
  fireEvent.click(consent);
  expect(next).toBeEnabled();
  fireEvent.click(next);
  expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each(["en", "es"])("%s all professional welcome routes keep written content without the narration panel", async language => {
  await i18n.changeLanguage(language);
  for (const path of ["/trainer-welcome", "/physician-welcome", "/procare-welcome"]) {
    mockPath = path;
    const view = render(<ProCareWelcome />);
    expect(screen.queryByText("Hear the full journey explained by Chef Copilot")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Listen|Escuchar/ })).not.toBeInTheDocument();
    expect(view.container.querySelectorAll("button").length).toBeGreaterThan(0);
    expect(view.container.textContent!.length).toBeGreaterThan(200);
    view.unmount();
  }
  expect(global.fetch).not.toHaveBeenCalled();
});


test.each(["en", "es"])("%s professional welcome resolves every active translation key", async language => {
  await i18n.changeLanguage(language);

  const keys = [
    "back",
    "beginJourney",
    "chefAlt",
    "title",
    "accountReady.trainer",
    "accountReady.physician",
    "accountReady.professional",
    "introduction",
    "profileComplete",
    "journeyHeading",
    "steps.experience.title",
    "steps.experience.description",
    "steps.fundamentals.title",
    "steps.fundamentals.description",
    "steps.business.title",
    "steps.business.description",
    "certificationHeading",
    "benefits.features",
    "benefits.personalization",
    "benefits.responsibleAI",
    "benefits.clientOnboarding",
    "benefits.automation",
    "benefits.revenue",
    "benefits.studio",
    "benefits.clientQuestions",
    "closingStatement",
  ];

  for (const key of keys) {
    const fullKey = `procare.welcome.${key}`;
    const resource = i18n.getResource(language, "translation", fullKey);
    expect(typeof resource).toBe("string");
    expect(resource.trim().length).toBeGreaterThan(0);
    expect(i18n.t(fullKey)).toBe(resource);
  }
});

test.each(["en", "es"])("%s professional welcome renders localized content and preserves role navigation", async language => {
  await i18n.changeLanguage(language);

  const routes = [
    ["/trainer-welcome", "trainer", "/professional-onboarding-bridge"],
    ["/physician-welcome", "physician", "/professional-onboarding-bridge"],
    ["/procare-welcome", "professional", "/procare-identity"],
  ];

  for (const [path, role, destination] of routes) {
    mockPath = path;
    mockNavigate.mockClear();
    const view = render(<ProCareWelcome />);

    const copy = (key: string) => i18n.t(`procare.welcome.${key}`);

    expect(screen.getByRole("heading", { name: copy("title") })).toBeInTheDocument();
    expect(view.container).toHaveTextContent(copy(`accountReady.${role}`));
    expect(view.container).toHaveTextContent(copy("introduction"));
    expect(view.container).toHaveTextContent(copy("journeyHeading"));
    expect(view.container).toHaveTextContent(copy("certificationHeading"));
    expect(view.container).toHaveTextContent(copy("closingStatement"));

    for (const step of ["experience", "fundamentals", "business"]) {
      expect(view.container).toHaveTextContent(copy(`steps.${step}.title`));
      expect(view.container).toHaveTextContent(copy(`steps.${step}.description`));
    }

    for (const benefit of [
      "features", "personalization", "responsibleAI",
      "clientOnboarding", "automation", "revenue",
      "studio", "clientQuestions",
    ]) {
      expect(view.container).toHaveTextContent(copy(`benefits.${benefit}`));
    }

    if (language === "es") {
      expect(view.container).not.toHaveTextContent("Your Professional Journey");
      expect(view.container).not.toHaveTextContent("Learn every feature of the platform");
    }

    fireEvent.click(screen.getByRole("button", { name: copy("back") }));
    expect(mockNavigate).toHaveBeenCalledWith("/business-center");

    fireEvent.click(screen.getByRole("button", { name: copy("beginJourney") }));
    expect(mockNavigate).toHaveBeenCalledWith(destination);

    expect(screen.queryByRole("button", { name: /Listen|Escuchar/ })).not.toBeInTheDocument();
    view.unmount();
  }

  expect(global.fetch).not.toHaveBeenCalled();
});

test("professional welcome follows global language changes without remounting", async () => {
  mockPath = "/trainer-welcome";
  await i18n.changeLanguage("en");
  render(<ProCareWelcome />);

  expect(screen.getByText("Your Professional Journey")).toBeInTheDocument();

  await act(async () => {
    await i18n.changeLanguage("es");
  });

  expect(screen.getByText("Su trayectoria profesional")).toBeInTheDocument();
  expect(screen.queryByText("Your Professional Journey")).not.toBeInTheDocument();

  await act(async () => {
    await i18n.changeLanguage("en");
  });

  expect(screen.getByText("Your Professional Journey")).toBeInTheDocument();
});

test("Kitchen Network ignores a saved narration opt-in while preserving written Next navigation", async () => {
  localStorage.setItem("mpm.copilot.narration.enabled", "true");
  render(<ChefCoPilotWalkthrough isOpen onClose={jest.fn()} onApply={jest.fn()} onBook={jest.fn()} onContact={jest.fn()} />);
  expect(screen.queryByTitle(/narration|Pause|Resume/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Listen to narration")).not.toBeInTheDocument();
  const before = document.body.textContent;
  fireEvent.click(screen.getByRole("button", { name: /Next/i }));
  await waitFor(() => expect(document.body.textContent).not.toBe(before));
  expect(global.fetch).not.toHaveBeenCalled();
  expect(window.Audio).not.toHaveBeenCalled();
});
