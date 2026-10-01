/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/api", () => ({ get: jest.fn(), post: jest.fn() }));

import { post } from "@/lib/api";
import { MealImageSlot } from "@/components/ui/MealImageSlot";

const originalUrl = "/public-objects/replit-objstore-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/meal-images/original.jpg";
const repairedUrl = "/public-objects/replit-objstore-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/meal-images/repaired.jpg";

function card(mealId: string) {
  return render(
    <React.StrictMode>
      <MealImageSlot
        imageUrl={originalUrl}
        mealName="Chicken and kale"
        boardTarget={{
          weekStartISO: "2026-09-28",
          dateISO: "2026-10-01",
          slot: "breakfast",
          mealId,
          builderType: "diabetic",
        }}
      />
    </React.StrictMode>,
  );
}

describe("Board image recovery under StrictMode", () => {
  it("receives the repair result after effect replay instead of spinning forever", async () => {
    jest.mocked(post).mockResolvedValue({ status: "recovered", imageUrl: repairedUrl });
    const view = card("strict-recovered");
    fireEvent.error(screen.getByAltText("Chicken and kale"));
    await waitFor(() => {
      expect(screen.getByAltText("Chicken and kale").getAttribute("src")).toBe(repairedUrl);
    });
    expect(post).toHaveBeenCalledWith("/api/weekly-board/image-recovery", expect.objectContaining({
      builderType: "diabetic",
      mealId: "strict-recovered",
      imageUrl: originalUrl,
    }));
    view.unmount();
  });

  it("ends recovery with an unavailable state when the endpoint fails", async () => {
    jest.mocked(post).mockRejectedValue(new Error("Storage unavailable"));
    const view = card("strict-unavailable");
    fireEvent.error(screen.getByAltText("Chicken and kale"));
    await waitFor(() => expect(screen.getByText("Image unavailable")).toBeTruthy());
    expect(screen.queryByText("imageStates.restoring")).toBeNull();
    view.unmount();
  });
});