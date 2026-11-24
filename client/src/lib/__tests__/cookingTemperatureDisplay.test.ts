import { formatCookingTemperatureText } from "../../../../shared/units";

describe("cooking temperature display", () => {
  const format = formatCookingTemperatureText;

  test("converts Fahrenheit oven temperatures to metric", () => {
    expect(format("Preheat oven to 350°F.", "metric"))
      .toBe("Preheat oven to 175°C.");
  });

  test("converts Celsius oven temperatures to imperial", () => {
    expect(format("Preheat oven to 175°C.", "imperial"))
      .toBe("Preheat oven to 350°F.");
  });

  test("supports Spanish cooking instructions", () => {
    expect(format("Precalentar el horno a 350 grados Fahrenheit.", "metric"))
      .toBe("Precalentar el horno a 175°C.");
  });

  test("converts complete oven temperature ranges", () => {
    expect(format("Preheat oven to 350–375°F.", "metric"))
      .toBe("Preheat oven to 175°C–190°C.");
  });

  test("preserves food-safety precision and original reference", () => {
    expect(format("Cook until 165°F.", "metric"))
      .toBe("Cook until ≈73.9°C (165°F).");
  });

  test("preserves existing dual-unit references", () => {
    expect(format("Cook until 165°F (74°C).", "metric"))
      .toBe("Cook until 165°F (74°C).");
  });

  test("does not change cooking times", () => {
    expect(format("Bake for 20 minutes.", "metric"))
      .toBe("Bake for 20 minutes.");
  });

  test("does not convert the same text twice", () => {
    const once = format("Preheat oven to 350°F.", "metric");
    expect(format(once, "metric")).toBe(once);
  });
});
