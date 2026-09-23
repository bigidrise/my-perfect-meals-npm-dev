/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import OneTouchCreateModal from "./OneTouchCreateModal";

describe("Creator Menu modal", () => {
  it("exposes only servings, cuisine, and dietary preference controls", () => {
    render(
      <OneTouchCreateModal
        open
        onOpenChange={jest.fn()}
        creator="create_a_dish"
        defaultServings={2}
        savedCuisine="Mediterranean"
        savedDiet="omnivore"
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText("Create a Dish Menu")).toBeInTheDocument();
    expect(screen.getByText("Servings")).toBeInTheDocument();
    expect(screen.getByText("Cuisine")).toBeInTheDocument();
    expect(screen.getByText("Dietary Preference")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create 3 ideas/i })).toBeInTheDocument();
    expect(screen.queryByText(/protein|cooking method|texture|flavor profile/i)).not.toBeInTheDocument();
  });

  it("labels the Craving Creator variant as Craving Menu", () => {
    render(
      <OneTouchCreateModal
        open
        onOpenChange={jest.fn()}
        creator="craving_creator"
        defaultServings={1}
        savedCuisine="Italian"
        savedDiet="omnivore"
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText("Craving Menu")).toBeInTheDocument();
    expect(screen.queryByText("One-Touch Create")).not.toBeInTheDocument();
  });
});