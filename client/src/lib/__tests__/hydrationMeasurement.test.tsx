/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import HydrationCenter from "@/pages/HydrationCenter";

const mockNavigate = jest.fn();
const mockToast = jest.fn();
const mockHydration = jest.fn();
const mockAddWater = jest.fn();
let mockSystem: "imperial" | "metric" = "imperial";

jest.mock("wouter", () => ({
  useLocation: () => ["/hydration", mockNavigate],
}));
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ initial, animate, transition, children, ...props }: any) =>
      <div {...props}>{children}</div>,
  },
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "offline-subject" } }),
}));
jest.mock("@/hooks/useMeasurementSystem", () => ({
  useMeasurementSystem: () => mockSystem,
}));
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock("@/contexts/PageTitleContext", () => ({
  usePageTitle: jest.fn(),
}));
jest.mock("@/lib/developmentRuntimeFlag", () => ({
  isDevelopmentRuntime: false,
}));
jest.mock("@/components/biometrics/BasicHydrationLogger", () => ({
  BasicHydrationLogger: () => null,
}));
jest.mock("@/components/HydrationFourDoorPanels", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/lib/waterLogsApi", () => ({
  getWaterLogs: jest.fn().mockResolvedValue({ items: [] }),
  createWaterLog: jest.fn(),
}));
jest.mock("@/lib/hydrationApi", () => ({
  getHydrationHubState: (...args: any[]) => mockHydration(...args),
  addHydrationWater: (...args: any[]) => mockAddWater(...args),
  createHydrationHelp: jest.fn(),
  saveHydrationHubBarriers: jest.fn(),
  saveHydrationHubPreferences: jest.fn(),
}));

const fixture = {
  localDate: "2026-11-18",
  totalLoggedMl: 710,
  numericPolicy: {
    status: "NUMERIC_ACTIVE",
    targetKind: "ceiling",
    headroomToMaximumMl: 1500,
  },
  interventions: [],
  projections: {
    today: {
      totalFluidsMl: 710,
      plainWaterMl: 355,
      beverageMix: [
        { beverageClass: "water", amountMl: 355 },
        { beverageClass: "tea", amountMl: 355 },
      ],
    },
    dailyTotals: [
      { localDate: "2026-11-18", totalMl: 710, plainWaterMl: 355 },
    ],
  },
  todayHistory: [],
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockSystem = "imperial";
  jest.clearAllMocks();
  mockHydration.mockResolvedValue(fixture);
  mockAddWater.mockResolvedValue({});
});

afterEach(cleanup);

async function renderLoaded() {
  render(<HydrationCenter />);
  await screen.findByText(/Clinician-set (ceiling|range|minimum|target)/);
}

test("metric quick-add displays mL but submits the original ounce quantity", async () => {
  mockSystem = "metric";
  await renderLoaded();

  const button = screen.getByTestId("hydration-add-8oz");
  expect(button).toHaveTextContent("+237 mL");

  fireEvent.click(button);

  await waitFor(() => {
    expect(mockAddWater).toHaveBeenCalledWith({
      amount: 8,
      unit: "oz",
      beverageClass: "water",
    });
  });
});

jest.mock("@/components/MedicalSourcesInfo", () => ({
  MedicalSourcesInfo: ({ trigger }: any) => trigger ?? null,
}));

test("custom unit switching preserves the entered fluid volume", async () => {
  await renderLoaded();

  const input = screen.getByTestId("hydration-custom-amount");
  const selector = input.parentElement!.querySelector("select")!;

  expect(selector).toHaveValue("oz");

  fireEvent.change(input, { target: { value: "8" } });
  fireEvent.change(selector, { target: { value: "ml" } });

  expect(selector).toHaveValue("ml");
  expect(Number((input as HTMLInputElement).value)).toBeCloseTo(236.588, 1);

  fireEvent.click(screen.getByTestId("hydration-add-custom"));

  await waitFor(() => {
    expect(mockAddWater).toHaveBeenCalledWith({
      amount: expect.any(Number),
      unit: "ml",
      beverageClass: "water",
    });
  });

  expect(mockAddWater.mock.calls[0][0].amount).toBeCloseTo(236.588, 1);
});

test("metric preference defaults custom fluid entry to milliliters", async () => {
  mockSystem = "metric";
  await renderLoaded();

  const input = screen.getByTestId("hydration-custom-amount");
  const selector = input.parentElement!.querySelector("select")!;

  expect(selector).toHaveValue("ml");
});

test("changing measurement preference preserves an entered custom volume", async () => {
  const view = render(<HydrationCenter />);
  await screen.findByText("Clinician-set ceiling");

  const input = screen.getByTestId("hydration-custom-amount");
  const selector = input.parentElement!.querySelector("select")!;

  fireEvent.change(input, { target: { value: "8" } });
  expect(selector).toHaveValue("oz");

  mockSystem = "metric";
  view.rerender(<HydrationCenter />);

  await waitFor(() => {
    expect(selector).toHaveValue("ml");
    expect(Number((input as HTMLInputElement).value)).toBeCloseTo(236.588, 1);
  });
});

test("invalid custom amount is not relabeled when measurement preference changes", async () => {
  const view = render(<HydrationCenter />);
  await screen.findByText("Clinician-set ceiling");

  const input = screen.getByTestId("hydration-custom-amount");
  const selector = input.parentElement!.querySelector("select")!;

  fireEvent.change(input, { target: { value: "8." } });
  expect(selector).toHaveValue("oz");

  mockSystem = "metric";
  view.rerender(<HydrationCenter />);

  await waitFor(() => {
    expect(selector).toHaveValue("oz");
  });
  expect((input as HTMLInputElement).value).toBe("8.");
});

test("metric hydration totals display milliliters as the primary unit", async () => {
  mockSystem = "metric";
  await renderLoaded();

  const total = screen.getByText("Total fluids").parentElement!;
  const water = screen.getAllByText("Plain water").find(element => element.parentElement?.querySelector(".text-3xl"))?.parentElement!;

  expect(total.querySelector(".text-3xl")).toHaveTextContent("710 mL");
  expect(water.querySelector(".text-3xl")).toHaveTextContent("355 mL");
});

test("metric beverage breakdown displays milliliters", async () => {
  mockSystem = "metric";
  await renderLoaded();

  expect(screen.getByText("Plain water: 355 mL")).toBeInTheDocument();
  expect(screen.getByText("Tea: 355 mL")).toBeInTheDocument();
});

test("metric today's history displays milliliters as the primary quantity", async () => {
  mockSystem = "metric";
  mockHydration.mockResolvedValue({
    ...fixture,
    todayHistory: [
      {
        id: "history-water-1",
        intakeTime: "2026-11-18T14:00:00.000Z",
        beverageClass: "water",
        amountMl: 355,
      },
    ],
  });

  await renderLoaded();

  const historyRow = screen.getByText("Plain water", {
    selector: "span.ml-2",
  }).closest(".flex.items-center.justify-between");

  expect(historyRow).not.toBeNull();
  expect(historyRow?.querySelector("span.font-medium"))
    .toHaveTextContent(/^355 mL$/);
});

test.each(["7", "30"])(
  "metric %s-day history displays milliliters",
  async (window) => {
    mockSystem = "metric";
    mockHydration.mockResolvedValue({
      ...fixture,
      projections: {
        ...fixture.projections,
        dailyTotals: [
          { localDate: new Date().toISOString().slice(0, 10), totalMl: 710, plainWaterMl: 355 },
        ],
      },
    });
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", {
      name: `${window} days`,
    }));

    expect(screen.getByText("710 mL total")).toBeInTheDocument();
    expect(screen.getByText("355 mL water")).toBeInTheDocument();
  },
);


test("imperial totals retain ounces as the primary unit", async () => {
  await renderLoaded();

  const total = screen.getByText("Total fluids").parentElement!;
  expect(total.querySelector(".text-3xl")).toHaveTextContent("24 oz");
  expect(
    Array.from(total.querySelectorAll("p.text-xs"))
      .some(element => element.textContent?.includes("710 mL"))
  ).toBe(true);
});

test("metric totals do not repeat milliliters in secondary labels", async () => {
  mockSystem = "metric";
  await renderLoaded();

  const total = screen.getByText("Total fluids").parentElement!;
  const water = screen.getAllByText("Plain water").find(
    element => element.parentElement?.querySelector(".text-3xl")
  )?.parentElement!;

  expect(total.querySelector(".text-3xl")).toHaveTextContent("710 mL");
  expect(
    Array.from(total.querySelectorAll("p.text-xs"))
      .some(element => element.textContent?.includes("710 mL"))
  ).toBe(false);

  expect(water.querySelector(".text-3xl")).toHaveTextContent("355 mL");

  expect(
    Array.from(water.querySelectorAll("p.text-xs"))
      .some(element => element.textContent?.includes("355 mL"))
  ).toBe(false);
});

test("Spanish metric history translations are available", () => {
  const translate = i18n.getFixedT("es", "consumerJourney");

  expect(translate("{{amount}} mL total", { amount: "710" }))
    .toBe("710 mL en total");
  expect(translate("{{amount}} mL water", { amount: "355" }))
    .toBe("355 mL de agua");
});


test.each([
  ["ceiling", "Clinician-set ceiling",
   "51 oz (1,500 mL) remains before the clinician-set maximum. This is a limit, not a goal.",
   "1,500 mL remains before the clinician-set maximum. This is a limit, not a goal."],
  ["range", "Clinician-set range",
   "10 oz (300 mL) to the lower bound; 51 oz (1,500 mL) before the upper bound.",
   "300 mL to the lower bound; 1,500 mL before the upper bound."],
  ["floor", "Clinician-set minimum",
   "10 oz (300 mL) remains.",
   "300 mL remains."],
  ["point", "Clinician-set target",
   "10 oz (300 mL) remains today.",
   "300 mL remains today."],
] as const)(
  "clinical %s directive displays correctly in both measurement systems",
  async (targetKind, title, imperialBody, metricBody) => {
    mockHydration.mockResolvedValue({
      ...fixture,
      numericPolicy: {
        ...fixture.numericPolicy,
        status: "NUMERIC_ACTIVE",
        targetKind,
        remainingMl: 300,
        remainingToMinimumMl: 300,
        headroomToMaximumMl: 1500,
      },
    });

    mockSystem = "imperial";
    await renderLoaded();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(imperialBody)).toBeInTheDocument();

    cleanup();
    mockSystem = "metric";
    await renderLoaded();
    expect(screen.getByText(metricBody)).toBeInTheDocument();
  }
);
