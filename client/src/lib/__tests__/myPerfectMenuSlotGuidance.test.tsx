/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import fs from "fs";
import path from "path";
import { MealPlanDestinationPicker } from "@/components/MealPlanDestinationPicker";
import {
  getMyPerfectMenuSlotGuidance,
  getMyPerfectMenuSlotInstruction,
  isMyPerfectMenuSuggestedSlot,
} from "@/lib/myPerfectMenuSlotGuidance";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (url: string) => url }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/activeBuilderNs", () => ({ getActiveBuilderNs: () => "general" }));
jest.mock("@/utils/midnight", () => ({
  ...jest.requireActual("@/utils/midnight"),
  getTodayISOSafe: () => "2026-10-09",
  getWeekStartFromDate: () => "2026-10-05",
  formatDateDisplay: (date: string) => date,
}));
// Keep the real picker and handlers; isolate only the Drawer portal/gesture shell.
jest.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: any) => open ? <div role="dialog">{children}</div> : null,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
}));

const regularSlots = ["breakfast", "lunch", "dinner", "meal4", "meal5", "meal6"];
const originalFetch = global.fetch;
let mockFetch: jest.Mock;
beforeEach(() => {
  mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      week: { days: { "2026-10-09": { breakfast: [{ title: "Existing breakfast" }] } } },
    }),
  });
  global.fetch = mockFetch;
});
afterAll(() => { global.fetch = originalFetch; });

async function readyPicker(menuIdeaType: string | undefined = "snack", title = "Chocolate Avocado Mousse") {
  const onSelect = jest.fn();
  const props = {
    open: true, onOpenChange: jest.fn(), title, menuIdeaType, onSelect,
  };
  const view = render(<MealPlanDestinationPicker {...props} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Meal 1/ })).toBeEnabled());
  return { onSelect, props, ...view };
}

describe("My Perfect Menu destination instructions", () => {
  it("explains the Snack destination for both snack families", () => {
    expect(getMyPerfectMenuSlotInstruction("snack")).toEqual({
      title: "Where to add your snack",
      message: "Snack is the recommended slot for snacks and dessert snacks. You can also choose any Meal 1–6 slot.",
      pickerMessage: "Snack is recommended. You can also choose any Meal 1–6 slot.",
    });
  });
  it.each(["breakfast", "lunch", "dinner"])("explains Meal 1–6 for %s", idea => {
    expect(getMyPerfectMenuSlotInstruction(idea)?.message)
      .toBe("Choose one of your Meal 1–6 slots to add this meal to your plan.");
  });
  it.each(regularSlots)("allows every food category in %s", slot => {
    for (const category of ["snack", "breakfast", "lunch", "dinner", "shake", "smoothie", "dessert", "mixed", "unknown"]) {
      expect(getMyPerfectMenuSlotGuidance(category, slot)).toBeUndefined();
    }
  });
  it("does not infer a mismatch from an absent or unknown destination", () => {
    for (const slot of ["snacks", null, undefined, "unknown"]) {
      expect(getMyPerfectMenuSlotGuidance("snack", slot)).toBeUndefined();
    }
  });
});

describe("Add to Plan snack guidance", () => {
  it.each(["Savory food snack", "Chocolate Avocado Mousse"])(
    "allows %s in every Meal 1–6 slot without category warnings",
    async title => {
      const { onSelect } = await readyPicker("snack", title);
      const readsBeforeClick = mockFetch.mock.calls.length;
      for (let number = 1; number <= 6; number++) {
        const button = screen.getByRole("button", { name: new RegExp(`Meal ${number}`) });
        expect(button).toBeEnabled();
        fireEvent.click(button);
        if (number === 1) {
          expect(screen.getByText("Replace existing meal?")).toBeInTheDocument();
          fireEvent.click(screen.getByRole("button", { name: "Replace and Create" }));
          fireEvent.click(screen.getByRole("button", { name: "Back" }));
        }
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(onSelect).toHaveBeenLastCalledWith({
          dateISO: "2026-10-09", slot: regularSlots[number - 1], builderType: "general",
        });
      }
      expect(onSelect).toHaveBeenCalledTimes(6);
      expect(mockFetch).toHaveBeenCalledTimes(readsBeforeClick);
      expect(screen.queryByText("Replace existing meal?")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Snack/ })).toBeEnabled();
    },
  );
  it.each(["Savory food snack", "Chocolate Avocado Mousse"])("recommends Snack and assigns %s there normally", async title => {
    const { onSelect } = await readyPicker("snack", title);
    const snack = screen.getByRole("button", { name: /Snack/ });
    expect(snack.className).toContain("border-violet-400");
    expect(screen.getByText("Snack is recommended. You can also choose any Meal 1–6 slot.")).toBeInTheDocument();
    expect(screen.getAllByText("Suggested slot")).toHaveLength(1);
    fireEvent.click(snack);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      dateISO: "2026-10-09", slot: "snacks", builderType: "general",
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it.each([
    ["Protein shake", "breakfast"],
    ["Savory food snack", "lunch"],
    ["Chocolate Avocado Mousse", "dinner"],
  ])("hands %s to the selected regular meal destination", async (title, slot) => {
    const { onSelect } = await readyPicker("snack", title);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Meal ${regularSlots.indexOf(slot) + 1}`) }));
    if (slot === "breakfast") {
      expect(onSelect).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Replace and Create" }));
    }
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ dateISO: "2026-10-09", slot, builderType: "general" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it.each(["breakfast", "lunch", "dinner"].flatMap(category =>
    regularSlots.map(slot => [category, slot]),
  ))(
    "preserves %s assignment to %s",
    async (category, slot) => {
      const { onSelect } = await readyPicker(category, "Regular meal idea");
      fireEvent.click(screen.getByRole("button", {
        name: new RegExp(`Meal ${regularSlots.indexOf(slot) + 1}`),
      }));
      if (slot === "breakfast") {
        fireEvent.click(screen.getByRole("button", { name: "Replace and Create" }));
      }
      expect(onSelect).toHaveBeenCalledWith({
        dateISO: "2026-10-09", slot, builderType: "general",
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );
  it("preserves replacement confirmation for regular meals in occupied slots", async () => {
    const { onSelect } = await readyPicker("breakfast", "Breakfast idea");
    fireEvent.click(screen.getByRole("button", { name: /Meal 1/ }));
    expect(screen.getByText("Replace existing meal?")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Replace and Create" }));
    expect(onSelect).toHaveBeenCalledWith({
      dateISO: "2026-10-09", slot: "breakfast", builderType: "general",
    });
  });
  it("clears guidance when the picker is reopened", async () => {
    const { rerender, props } = await readyPicker("dinner");
    fireEvent.click(screen.getByRole("button", { name: /Snack/ }));
    rerender(<MealPlanDestinationPicker {...props} open={false} />);
    rerender(<MealPlanDestinationPicker {...props} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("brings guidance into view on every unsupported click, including repeated clicks", async () => {
    const previous = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      await readyPicker("dinner");
      fireEvent.click(screen.getByRole("button", { name: /Snack/ }));
      fireEvent.click(screen.getByRole("button", { name: /Snack/ }));
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
    } finally {
      HTMLElement.prototype.scrollIntoView = previous;
    }
  });
  it("keeps the existing unrestricted behavior when callers do not opt in", async () => {
    const { onSelect } = await readyPicker("unknown");
    fireEvent.click(screen.getByRole("button", { name: /Meal 2/ }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("does not replace a real board-read failure with slot guidance", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    render(<MealPlanDestinationPicker open onOpenChange={jest.fn()} title="Snack idea" menuIdeaType="snack" onSelect={jest.fn()} />);
    expect(await screen.findByText("We couldn't check your current meal plan.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

it("wires Menu-only guidance above ideas and in both destination selectors without rewriting generation failures", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "client/src/pages/MyPerfectMenu.tsx"), "utf8");
  expect(source).toContain("getMyPerfectMenuSlotInstruction(ideaType)?.message");
  expect(source).toContain("menuIdeaType={selectedConcept.ideaType}");
  expect(source).toContain("if (getMyPerfectMenuSlotGuidance(ideaType, performanceSlot)) return;");
  expect(source).toContain("if (getMyPerfectMenuSlotGuidance(concept.ideaType, performanceDestination.slot))");
  const performanceGuard = source.indexOf("if (getMyPerfectMenuSlotGuidance(concept.ideaType, performanceDestination.slot))");
  expect(source.slice(performanceGuard, source.indexOf("void generateForDestination(performanceDestination, concept)", performanceGuard)))
    .toContain("setPendingIdeaType(concept.ideaType)");
  expect(source).toContain('if (!meal) throw new Error("We couldn\'t finish this meal. Please choose it again.");');
  expect(source).toContain('setError(cause instanceof Error ? cause.message : "We couldn\'t finish this meal.");');
});

describe("Meal slot highlighting and unknown-category fallback", () => {
  it.each(["breakfast", "lunch", "dinner"])("highlights all six Meal rows for %s and rejects Snack before generation", async category => {
    const { onSelect } = await readyPicker(category, "Recipe name does not determine the category");
    expect(screen.getByText("Choose one of the highlighted meal slots to add your meal.")).toBeInTheDocument();
    expect(screen.getAllByText("Suggested slot")).toHaveLength(6);
    for (let number = 1; number <= 6; number++) {
      const button = screen.getByRole("button", { name: new RegExp(`Meal ${number}`) });
      expect(button).toBeEnabled();
      expect(button.className).toContain("border-violet-400");
      expect(button.className).toContain("shadow-");
    }
    const snack = screen.getByRole("button", { name: /Snack/ });
    expect(snack).toBeEnabled();
    expect(snack.className).not.toContain("border-violet-400");
    const readsBeforeClick = mockFetch.mock.calls.length;
    fireEvent.click(snack);
    expect(screen.getByRole("status")).toHaveTextContent("Please select one of the highlighted meal slots for this meal.");
    expect(onSelect).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(readsBeforeClick);
    fireEvent.click(screen.getByRole("button", { name: /Meal 2/ }));
    expect(onSelect).toHaveBeenCalledWith({
      dateISO: "2026-10-09", slot: "lunch", builderType: "general",
    });
  });
  it.each(["unknown", "dessert", ""])("does not guess destinations for category %s", async category => {
    const { onSelect } = await readyPicker(category, "Chocolate Avocado Mousse");
    expect(screen.queryByText("Suggested slot")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Snack/ }));
    expect(onSelect).toHaveBeenCalledWith({
      dateISO: "2026-10-09", slot: "snacks", builderType: "general",
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("leaves missing-category callers unrestricted", async () => {
    const onSelect = jest.fn();
    render(<MealPlanDestinationPicker open onOpenChange={jest.fn()} title="Snack in name only" onSelect={onSelect} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Meal 2/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Meal 2/ }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByText("Suggested slot")).not.toBeInTheDocument();
    expect(getMyPerfectMenuSlotInstruction(undefined)).toBeUndefined();
    expect(getMyPerfectMenuSlotGuidance(undefined, "snacks")).toBeUndefined();
    expect(isMyPerfectMenuSuggestedSlot(undefined, "breakfast")).toBe(false);
  });
  it("retains the mobile date grid and desktop date strip without changing slot order", async () => {
    await readyPicker("snack");
    const buttons = screen.getAllByRole("button");
    expect(buttons.filter(button => /Meal [1-6]|Snack/.test(button.textContent ?? "")).map(button =>
      button.textContent?.match(/Meal [1-6]|Snack/)?.[0],
    )).toEqual(["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Meal 5", "Meal 6", "Snack"]);
    expect(document.querySelector(".sm\\:hidden")).toBeInTheDocument();
    expect(document.querySelector(".sm\\:flex")).toBeInTheDocument();
  });
});
