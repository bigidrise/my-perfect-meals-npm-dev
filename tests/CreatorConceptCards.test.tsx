/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { CreatorConceptCards } from "../client/src/components/one-touch/CreatorConceptCards";
import type { OneTouchConcept } from "@shared/oneTouch";

const concepts = [1, 2, 3].map((number) => ({
  id: `idea-${number}`,
  title: `Idea ${number}`,
  description: "A safe meal idea",
  cuisine: "Italian",
  preparationMethod: "Simmered",
  primaryIngredients: ["vegetables"],
})) as OneTouchConcept[];

test("a completed recipe keeps all three ideas available until the user removes them", () => {
  const onChoose = jest.fn();
  const onClear = jest.fn();
  render(
    <CreatorConceptCards
      concepts={concepts}
      choosingId={null}
      generating={false}
      selectedConceptId="idea-1"
      completedMealVisible
      onChoose={onChoose}
      onTryMore={jest.fn()}
      onClear={onClear}
    />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Current recipe" })).toBeDisabled();
  expect(screen.getAllByRole("button", { name: "Choose This" })).toHaveLength(2);
  expect(screen.getByText(/save a finished recipe to favorites/i)).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Choose This" })[0]);
  expect(onChoose).toHaveBeenCalledWith("idea-2");
  expect(onClear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remove Menu ideas" }));
  expect(onClear).toHaveBeenCalledTimes(1);
});