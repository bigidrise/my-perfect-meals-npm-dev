/**
 * @jest-environment jsdom
 *
 * InspirationCaptureModal — ndeSummary adaptation banner on single-card fallback
 *
 * Confirms that:
 *  1. The "ADAPTED FOR TODAY'S NUTRITION STRATEGY" banner and its adaptedNote
 *     are visible when the restored scan carries ndeSummary.wasAdapted=true
 *     and a non-empty ndeSummary.adaptedNote, with a single mealData result
 *     (no options array).
 *  2. The banner is absent when ndeSummary.wasAdapted=false.
 *  3. The banner is absent when ndeSummary.adaptedNote is missing.
 *
 * Approach: pre-seed localStorage (mpm.recipe.lastScan) so the useEffect
 * restore path puts the component directly into the "preview" phase without
 * any fetch calls, then assert banner visibility.
 */

// ── Module mocks — must appear before any imports ─────────────────────────────

// UniversalDialog must render its children so the preview pane is visible.
jest.mock("@/components/ui/universal-modal", () => ({
  UniversalDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const R = require("react");
    return open ? R.createElement("div", { "data-testid": "dialog" }, children) : null;
  },
}));

jest.mock("@/components/ui/dialog", () => ({
  DialogHeader: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const R = require("react");
    return R.createElement("div", null, children);
  },
  DialogTitle: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const R = require("react");
    return R.createElement("div", null, children);
  },
}));

jest.mock("wouter", () => ({ useLocation: () => ["/", jest.fn()] }));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/components/copilot/CopilotContext", () => ({
  useCopilot: () => ({ open: jest.fn(), setLastResponse: jest.fn() }),
}));

jest.mock("@/components/copilot/CopilotRespectGuard", () => ({
  shouldAllowAutoOpen: () => false,
}));

jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (path: string) => `http://localhost:5000${path}`,
}));

jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));

jest.mock("@/lib/sentry", () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
}));

// UI sub-components — not needed for banner visibility assertions
jest.mock("@/components/ui/pill-button", () => ({
  PillButton: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const R = require("react");
    return R.createElement("button", null, children);
  },
}));

jest.mock("@/components/AlphaGalBadge", () => () => null);

jest.mock("@/components/ui/CuisineOverrideControl", () => ({
  CuisineOverrideControl: () => null,
}));

jest.mock("@/components/ui/MealImageSlot", () => ({
  MealImageSlot: () => null,
}));

// ── Actual imports ────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import InspirationCaptureModal from "@/components/InspirationCaptureModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mpm.recipe.lastScan";

// The i18n key used by the banner label — our mock returns the key as-is
const ADAPTED_LABEL_KEY = "inspiration.adaptedForStrategy";
const ADAPTED_NOTE = "Protein target raised to support your GLP-1 nutrition strategy.";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Single-card result with adaptation active */
const SINGLE_CARD_ADAPTED = {
  success: true,
  title: "Grilled Salmon",
  mealData: {
    title: "Grilled Salmon",
    description: "A lean protein-rich dish.",
    nutrition: { calories: 520, protein: 40, carbs: 20, fat: 18 },
  },
  // No "options" array — triggers the single-card fallback path
  ndeSummary: {
    wasAdapted: true,
    adaptedNote: ADAPTED_NOTE,
  },
};

/** Single-card result with adaptation disabled */
const SINGLE_CARD_NOT_ADAPTED = {
  success: true,
  title: "Grilled Salmon",
  mealData: {
    title: "Grilled Salmon",
    description: "A lean protein-rich dish.",
    nutrition: { calories: 520, protein: 40, carbs: 20, fat: 18 },
  },
  ndeSummary: {
    wasAdapted: false,
    adaptedNote: ADAPTED_NOTE,
  },
};

/** Single-card result with wasAdapted=true but no adaptedNote */
const SINGLE_CARD_ADAPTED_NO_NOTE = {
  success: true,
  title: "Grilled Salmon",
  mealData: {
    title: "Grilled Salmon",
    description: "A lean protein-rich dish.",
    nutrition: { calories: 520, protein: 40, carbs: 20, fat: 18 },
  },
  ndeSummary: {
    wasAdapted: true,
    // adaptedNote intentionally absent
  },
};

// ── Helper ────────────────────────────────────────────────────────────────────

function renderModal(open = true) {
  return render(
    <InspirationCaptureModal
      open={open}
      onOpenChange={jest.fn()}
      destination="recipe"
    />,
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ── 1. Banner visible when wasAdapted=true and adaptedNote is present ──────────

describe("NDE adaptation banner — single-card fallback (wasAdapted=true)", () => {
  it("renders the banner label when the restored scan carries wasAdapted=true and adaptedNote", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SINGLE_CARD_ADAPTED));
    renderModal();

    await waitFor(() =>
      expect(screen.getByText(ADAPTED_LABEL_KEY)).toBeInTheDocument(),
    );
  });

  it("renders the adaptedNote text in the banner body", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SINGLE_CARD_ADAPTED));
    renderModal();

    await waitFor(() =>
      expect(screen.getByText(ADAPTED_NOTE)).toBeInTheDocument(),
    );
  });

  it("renders both the label and the note in the same scan restoration", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SINGLE_CARD_ADAPTED));
    renderModal();

    await waitFor(() => {
      expect(screen.getByText(ADAPTED_LABEL_KEY)).toBeInTheDocument();
      expect(screen.getByText(ADAPTED_NOTE)).toBeInTheDocument();
    });
  });
});

// ── 2. Banner absent when wasAdapted=false ─────────────────────────────────────

describe("NDE adaptation banner — absent when wasAdapted=false", () => {
  it("does not render the banner label when wasAdapted is false", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SINGLE_CARD_NOT_ADAPTED));
    renderModal();

    // Wait for the meal title to confirm the preview phase rendered
    await waitFor(() =>
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument(),
    );

    expect(screen.queryByText(ADAPTED_LABEL_KEY)).not.toBeInTheDocument();
  });

  it("does not render the adaptedNote text when wasAdapted is false", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SINGLE_CARD_NOT_ADAPTED));
    renderModal();

    await waitFor(() =>
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument(),
    );

    expect(screen.queryByText(ADAPTED_NOTE)).not.toBeInTheDocument();
  });
});

// ── 3. Banner absent when adaptedNote is missing (wasAdapted=true but no note) ─

describe("NDE adaptation banner — absent when adaptedNote is missing", () => {
  it("does not render the banner label when adaptedNote is absent even if wasAdapted=true", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SINGLE_CARD_ADAPTED_NO_NOTE));
    renderModal();

    await waitFor(() =>
      expect(screen.getByText("Grilled Salmon")).toBeInTheDocument(),
    );

    expect(screen.queryByText(ADAPTED_LABEL_KEY)).not.toBeInTheDocument();
  });
});

// ── 4. Absence when no localStorage result at all ─────────────────────────────

describe("NDE adaptation banner — absent when no scan is stored", () => {
  it("does not render the banner when localStorage is empty (capture phase)", () => {
    // No localStorage seeding — component stays in capture phase
    renderModal();

    expect(screen.queryByText(ADAPTED_LABEL_KEY)).not.toBeInTheDocument();
    expect(screen.queryByText(ADAPTED_NOTE)).not.toBeInTheDocument();
  });
});
