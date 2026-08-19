/**
 * @jest-environment jsdom
 *
 * CravingPicker and FixedMenuPicker — clinical constraint conflict handling
 *
 * Both pickers call the craving-creator endpoint. A clinical plan can
 * legitimately eliminate every generated option, so the server returns a
 * structured 422 rather than a generic transport failure. These tests verify
 * that the structured reason reaches the real toaster.
 */

// Keep this suite focused on the picker error path instead of MealCard's
// unrelated data fetching and clinical rendering dependencies.
jest.mock("@/components/MealCard", () => ({
  __esModule: true,
  default: () => null,
}));

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import CravingPicker from "@/components/CravingPicker";
import FixedMenuPicker from "@/components/FixedMenuPicker";
import { Toaster } from "@/components/ui/toaster";

const CLINICAL_BLOCK_MESSAGE =
  "Your current protocol leaves no safe options for this meal.";

function mockClinicalConflictResponse() {
  (globalThis.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 422,
    json: jest.fn().mockResolvedValue({
      reasonCode: "constraint_conflict",
      message: CLINICAL_BLOCK_MESSAGE,
    }),
  });
}

function renderWithToaster(children: React.ReactElement) {
  return render(
    <>
      {children}
      <Toaster />
    </>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as any).fetch = jest.fn();
  mockClinicalConflictResponse();
});

describe("clinical block reason in meal pickers", () => {
  it("CravingPicker shows the clinical reason instead of HTTP 422", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <CravingPicker
        open
        slotLabel="Breakfast"
        onClose={jest.fn()}
        onUse={jest.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Generate Breakfast Option" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("No options fit your current plan"),
      ).toBeInTheDocument();
      expect(screen.getByText(CLINICAL_BLOCK_MESSAGE)).toBeInTheDocument();
    });
    expect(screen.queryByText("HTTP 422")).not.toBeInTheDocument();
  });

  it("FixedMenuPicker shows the clinical reason instead of HTTP 422", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <FixedMenuPicker
        open
        slotLabel="Dinner"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add Meal" }));

    await waitFor(() => {
      expect(
        screen.getByText("No options fit your current plan"),
      ).toBeInTheDocument();
      expect(screen.getByText(CLINICAL_BLOCK_MESSAGE)).toBeInTheDocument();
    });
    expect(screen.queryByText("HTTP 422")).not.toBeInTheDocument();
  });
});