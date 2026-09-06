/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SafetyGuardBanner, type SafetyAlertState } from "@/components/SafetyGuardBanner";

const advisory: SafetyAlertState = {
  show: true,
  result: "ADVISORY",
  blockedTerms: ["steak"],
  blockedCategories: ["dietary identity"],
  ambiguousTerms: [],
  message: "Your Nutrition Life Plan is currently set to vegan.",
  suggestion: "Chef can create a vegan-friendly alternative.",
  reasonCode: "dietary_identity:vegan",
  enforcementLevel: "advisory",
  overrideAllowed: true,
  requestedFood: "steak",
  recommendedAlternative: "Create a vegan-friendly version.",
};

describe("SafetyGuardBanner food governance choices", () => {
  it("offers both the recommended alternative and a conscious advisory override", () => {
    const onAcceptAlternative = jest.fn();
    const onContinueAnyway = jest.fn();
    render(
      <SafetyGuardBanner
        alert={advisory}
        mealRequest="Steak"
        onDismiss={jest.fn()}
        onOverrideSuccess={jest.fn()}
        onAcceptAlternative={onAcceptAlternative}
        onContinueAnyway={onContinueAnyway}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "shopping.findProduct.alternatives" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue anyway" }));

    expect(onAcceptAlternative).toHaveBeenCalledTimes(1);
    expect(onContinueAnyway).toHaveBeenCalledTimes(1);
  });

  it("never exposes an advisory continue action for a server hard block", () => {
    render(
      <SafetyGuardBanner
        alert={{
          ...advisory,
          result: "BLOCKED",
          enforcementLevel: "hard_block",
          overrideAllowed: false,
          reasonCode: "allergy:beef",
        }}
        mealRequest="Steak"
        onDismiss={jest.fn()}
        onOverrideSuccess={jest.fn()}
        onAcceptAlternative={jest.fn()}
        onContinueAnyway={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Continue anyway" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "shopping.findProduct.alternatives" })).not.toBeInTheDocument();
  });
});