/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MealReminderPanelFrame } from "@/components/MealReminderPanelFrame";

test.each([false, true])("frame geometry is state-independent (native=%s)", isNative => {
  const view = (state: string) => (
    <MealReminderPanelFrame isNative={isNative} label="Meal Reminders">
      <div>{state}</div>
    </MealReminderPanelFrame>
  );
  const { rerender } = render(view("loading"));
  const frame = screen.getByRole("region", { name: "Meal Reminders" });
  const geometry = frame.className;
  for (const state of ["empty", "three slots", "six slots", "error: retry", "permission pending", "permission blocked"]) {
    rerender(view(state));
    expect(frame.className).toBe(geometry);
    expect(frame).toHaveClass("overflow-y-auto", "overscroll-contain");
    expect(frame).toHaveAttribute("tabindex", "0");
  }
});
