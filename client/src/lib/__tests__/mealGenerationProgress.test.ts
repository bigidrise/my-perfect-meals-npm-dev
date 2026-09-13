import {
  getMealGenerationCopy,
  startMealProgressRotation,
} from "../mealGenerationProgress";

describe("global meal generation progress", () => {
  test("rotates locally and stops exactly once", () => {
    let callback: (() => void) | null = null;
    let clears = 0;
    const timerApi = {
      setInterval: (next: () => void) => {
        callback = next;
        return 17 as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval: () => {
        clears += 1;
      },
    };
    const seen: string[] = [];
    const rotation = startMealProgressRotation(
      ["one", "two", "three"],
      (message) => seen.push(message),
      5000,
      timerApi,
    );
    callback?.();
    callback?.();
    expect(seen).toEqual(["one", "two", "three"]);
    rotation.stop();
    rotation.stop();
    expect(clears).toBe(1);
  });

  test("uses options language for multiple generated meals", () => {
    expect(getMealGenerationCopy("create-dish", "options").title).toBe(
      "Chef is crafting your meal options…",
    );
  });

  test("restaurant and pairing contexts never claim Chef is crafting", () => {
    expect(getMealGenerationCopy("restaurant", "search").title).not.toMatch(
      /chef|craft/i,
    );
    expect(getMealGenerationCopy("pairing", "pairing").title).not.toMatch(
      /chef|craft/i,
    );
  });

  test("clinical language appears only in applicable contexts", () => {
    const general = getMealGenerationCopy("general", "single").messages.join(" ");
    expect(general).not.toMatch(/medical|clinical|diabetes|glucose|pregnan|glp-1/i);
    expect(
      getMealGenerationCopy("diabetes", "options").messages.join(" "),
    ).toMatch(/glucose/i);
    expect(
      getMealGenerationCopy("pregnancy", "single").messages.join(" "),
    ).toMatch(/pregnancy/i);
  });

  test("companion and gathering generators use dedicated language", () => {
    expect(getMealGenerationCopy("companion", "single").messages.join(" "))
      .toMatch(/species-appropriate/i);
    expect(getMealGenerationCopy("gathering", "options").title)
      .toMatch(/gathering menu/i);
  });
});