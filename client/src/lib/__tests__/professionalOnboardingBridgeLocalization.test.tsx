/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import ProfessionalOnboardingBridge from "@/pages/procare/ProfessionalOnboardingBridge";

const mockNavigate = jest.fn();
const mockApiRequest = jest.fn();
let mockUser: any;

jest.mock("wouter", () => ({
  useLocation: () => ["/professional-onboarding-bridge", mockNavigate]
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser })
}));

jest.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args)
}));

const stageKeys = [
  [
    "step1Badge", "step1Title", "step1Desc",
    "personalProfileStep", "defineGoals", "firstMealPlan",
    "exploreTools", "experienceAsClient",
    "personalExperienceQuote", "step1Button"
  ],
  [
    "step2Title", "step2Excellent",
    "experienceCompleteTitle", "experienceCompleteDesc",
    "step2Badge", "step2Phase1Title", "step2Phase1Desc",
    "majorFeatures", "clientPersonalization", "responsibleAI",
    "clientSetup", "mealBoardsTracking", "step2Button"
  ],
  [
    "personalProfileComplete", "phase1Complete",
    "step3Title", "step3Desc", "step3Badge",
    "step3Phase2Title", "step3Phase2Desc",
    "learningItems.clientMgmt", "learningItems.questionnaires",
    "learningItems.communication", "learningItems.revenue",
    "affiliateBusinessSuite", "clientRetention", "step3Button"
  ]
];

const destinations = [
  "/onboarding",
  "/academy/platform-mastery",
  "/certifications/procare_certification"
];

beforeEach(() => {
  mockNavigate.mockReset();
  mockApiRequest.mockReset();
  localStorage.clear();
});

afterEach(() => cleanup());

function configureStage(stage: number) {
  mockUser = {
    id: "localization-test-user",
    professionalRole: "trainer",
    isAdmin: false,
    onboardingCompletedAt: stage > 0 ? "2026-11-24" : null
  };

  mockApiRequest.mockImplementation(async (path: string) => {
    if (path === "/api/certifications/phase1-status") {
      return { phase1Complete: stage === 2 };
    }
    if (path === "/api/certifications/procare_certification/progress") {
      return { certification: { status: "in_progress" } };
    }
    throw new Error(`Unexpected API request: ${path}`);
  });
}

test.each(["en", "es"])("%s contains every required bridge translation", async language => {
  await i18n.changeLanguage(language);

  for (const key of stageKeys.flat()) {
    const fullKey = `procare.bridge.${key}`;
    const resource = i18n.getResource(language, "translation", fullKey);

    expect(typeof resource).toBe("string");
    expect(resource.trim().length).toBeGreaterThan(0);
    expect(i18n.t(fullKey)).toBe(resource);
  }
});

test.each(["en", "es"])("%s renders and navigates all three onboarding stages", async language => {
  await i18n.changeLanguage(language);

  for (let stage = 0; stage < 3; stage++) {
    configureStage(stage);
    mockNavigate.mockClear();

    const view = render(<ProfessionalOnboardingBridge />);

    for (const key of stageKeys[stage]) {
      const expected = i18n.t(`procare.bridge.${key}`);
      expect((await screen.findAllByText(expected)).length).toBeGreaterThan(0);
    }

    const button = screen.getByRole("button", {
      name: i18n.t(`procare.bridge.step${stage + 1}Button`)
    });

    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith(destinations[stage]);

    view.unmount();
  }
});

test("the mounted bridge responds to language changes without restarting onboarding", async () => {
  await i18n.changeLanguage("en");
  configureStage(1);

  render(<ProfessionalOnboardingBridge />);

  expect(await screen.findByText(
    "You've Experienced My Perfect Meals as a User"
  )).toBeInTheDocument();

  const requestCount = mockApiRequest.mock.calls.length;

  await act(async () => {
    await i18n.changeLanguage("es");
  });

  expect(await screen.findByText(
    "Ya ha experimentado My Perfect Meals como usuario"
  )).toBeInTheDocument();

  await act(async () => {
    await i18n.changeLanguage("en");
  });

  expect(await screen.findByText(
    "You've Experienced My Perfect Meals as a User"
  )).toBeInTheDocument();

  expect(mockApiRequest.mock.calls.length).toBe(requestCount);
  expect(mockNavigate).not.toHaveBeenCalled();
});
