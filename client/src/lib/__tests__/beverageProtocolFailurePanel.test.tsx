/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import "@/i18n";
import {
  BeverageProtocolFailurePanel,
  isBeverageProtocolFailure,
  type BeverageProtocolFailure,
} from "@/components/BeverageProtocolFailurePanel";

const glp1Failure: BeverageProtocolFailure = {
  error: "PROTOCOL_VIOLATION",
  message: "Generated beverage exceeds GLP-1 clinical limits: fat is too high.",
  retryable: true,
  rejectionKind: "macro_noncompliant",
  protocolName: "GLP-1",
  alternatives: [
    {
      name: "GLP-1-Friendly Citrus Tequila Highball",
      description: "A lighter Dive Bar-style tequila highball.",
      ingredients: [
        { amount: "1.5", unit: "oz", name: "tequila" },
        { amount: "3", unit: "oz", name: "club soda" },
      ],
      nutrition: { calories: 110, carbs: 2, protein: 0, fat: 0 },
      reasoning: "Uses tequila, citrus, and club soda to keep the original highball direction with lighter macros.",
    },
  ],
};

describe("BeverageProtocolFailurePanel", () => {
  test("shows GLP-1 safeguard coaching and validated choices instead of a technical failure", async () => {
    const onUseAlternative = jest.fn();
    const user = userEvent.setup();
    render(
      <BeverageProtocolFailurePanel
        failure={glp1Failure}
        onUseAlternative={onUseAlternative}
        onRetry={jest.fn()}
        onAdjustPreferences={jest.fn()}
      />,
    );

    expect(
      screen.getByText("This drink doesn't fit your current GLP-1 nutrition settings."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("GLP-1-Friendly Citrus Tequila Highball"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong creating your drink/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use This Option" }));
    expect(onUseAlternative).toHaveBeenCalledWith(glp1Failure.alternatives[0]);
  });

  test("uses generic nutrition wording when the protocol is not known and keeps Try Again available", async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();
    render(
      <BeverageProtocolFailurePanel
        failure={{ ...glp1Failure, protocolName: null, alternatives: [] }}
        onUseAlternative={jest.fn()}
        onRetry={onRetry}
        onAdjustPreferences={jest.fn()}
      />,
    );

    expect(
      screen.getByText("This drink doesn't fit your current nutrition settings."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/couldn't validate a safe alternative/i),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Make Me a Better-Fit Drink" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("labels alternatives as alcohol-free only when the server identifies alcohol as the conflict", () => {
    const { rerender } = render(
      <BeverageProtocolFailurePanel
        failure={{ ...glp1Failure, rejectionKind: "alcohol_forbidden" }}
        onUseAlternative={jest.fn()}
        onRetry={jest.fn()}
        onAdjustPreferences={jest.fn()}
      />,
    );
    expect(screen.getByText(/alternatives below are alcohol-free/i)).toBeInTheDocument();

    rerender(
      <BeverageProtocolFailurePanel
        failure={glp1Failure}
        onUseAlternative={jest.fn()}
        onRetry={jest.fn()}
        onAdjustPreferences={jest.fn()}
      />,
    );
    expect(screen.queryByText(/alternatives below are alcohol-free/i)).not.toBeInTheDocument();
  });

  test("does not classify genuine technical failures as safeguard rejections", () => {
    expect(isBeverageProtocolFailure({ error: "Failed to create beverage" })).toBe(false);
    expect(isBeverageProtocolFailure({ error: "PROTOCOL_VIOLATION", retryable: false })).toBe(false);
  });
});