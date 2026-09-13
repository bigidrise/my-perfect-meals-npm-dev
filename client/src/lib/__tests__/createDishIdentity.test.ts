import fs from "node:fs";
import path from "node:path";
import {
  getCreateDishAlternatives,
  normalizeCreateDishOptions,
  selectCreateDishById,
  shouldApplyCreateDishResponse,
} from "../createDishIdentity";

describe("Create a Dish stable option identity", () => {
  const raw = [
    { id: "dish-a", name: "Same Name", imageUrl: "a.jpg" },
    { id: "dish-b", name: "Same Name", imageUrl: "b.jpg" },
    { id: "dish-c", name: "Third", imageUrl: "c.jpg" },
  ];

  test("normalizes missing or duplicate IDs without mutating the response", () => {
    const response = [
      { id: "duplicate", name: "A" },
      { id: "duplicate", name: "B" },
      { name: "C" },
    ];
    const snapshot = JSON.stringify(response);
    const normalized = normalizeCreateDishOptions(response, "request-7");

    expect(normalized.map((dish) => dish.id)).toEqual([
      "duplicate",
      "create-dish-request-7-2",
      "create-dish-request-7-3",
    ]);
    expect(new Set(normalized.map((dish) => dish.id)).size).toBe(3);
    expect(JSON.stringify(response)).toBe(snapshot);
  });

  test("generated fallback IDs cannot collide with server IDs", () => {
    const normalized = normalizeCreateDishOptions([
      { id: "create-dish-request-10-2", name: "A" },
      { id: "create-dish-request-10-2", name: "B" },
      { id: "", name: "C" },
    ], "request-10");

    expect(new Set(normalized.map((dish) => dish.id)).size).toBe(3);
  });

  test("rapid repeated selection changes only the selected ID", () => {
    const options = normalizeCreateDishOptions(raw, "request-8");
    const snapshot = JSON.stringify(options);
    let selectedId: string | null = null;

    for (const index of [0, 1, 2, 1, 0, 2, 2, 1]) {
      selectedId = options[index].id;
      expect(selectCreateDishById(options, selectedId)?.id).toBe(selectedId);
      expect(JSON.stringify(options)).toBe(snapshot);
    }

    expect(selectedId).toBe("dish-b");
  });

  test("same-name dishes remain distinct and alternatives filter by ID", () => {
    const options = normalizeCreateDishOptions(raw, "request-9");
    expect(selectCreateDishById(options, "dish-b")?.imageUrl).toBe("b.jpg");
    expect(getCreateDishAlternatives(options, "dish-b").map((dish) => dish.id))
      .toEqual(["dish-a", "dish-c"]);
  });

  test("stale generation responses cannot replace the active request", () => {
    expect(shouldApplyCreateDishResponse(12, 11)).toBe(false);
    expect(shouldApplyCreateDishResponse(12, 12)).toBe(true);
    expect(shouldApplyCreateDishResponse(13, 12)).toBe(false);
  });

  test("page uses ID identity and guards stale generation responses", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/lifestyle/CreateDishPage.tsx"),
      "utf8",
    );
    expect(source).toContain("selectedDishId");
    expect(source).toContain("shouldApplyCreateDishResponse");
    expect(source).toContain("signal: abortController.signal");
    expect(source).not.toContain("key={idx}");
    expect(source).not.toContain("o.name !== generatedMeals[0]?.name");
  });
});