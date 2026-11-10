/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import { TUTORIAL_VIDEO_REGISTRY, type TutorialFeature } from "@/lib/tutorialVideoRegistry";

afterEach(() => jest.restoreAllMocks());

test.each(Object.entries(TUTORIAL_VIDEO_REGISTRY).filter(([, url]) => Boolean(url)))(
  "%s opens only its assigned YouTube tutorial in a separate protected tab",
  (feature, url) => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    render(<HowThisWorksLink featureKey={feature as TutorialFeature} label="How It Works" />);
    const button = screen.getByRole("button", { name: "Watch tutorial: How It Works" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("title")).toBe("Watch tutorial: How It Works");
    expect(button.className).toContain("!min-h-[44px]");
    expect(button.className).toContain("!min-w-[44px]");
    expect(button.className).toContain("shrink-0");
    fireEvent.click(button);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
  },
);

test("keeps mobile compact and desktop labels available without shrinking the control", () => {
  render(<HowThisWorksLink featureKey="askChef" label="How It Works" />);
  const label = screen.getByText("How It Works");
  expect(label.className).toContain("hidden");
  expect(label.className).toContain("sm:block");
  expect(label.parentElement?.className).toContain("shrink-0");
});

test("opens the tutorial without submitting its surrounding form", () => {
  const submit = jest.fn((event: React.FormEvent) => event.preventDefault());
  const open = jest.spyOn(window, "open").mockImplementation(() => null);
  render(
    <form onSubmit={submit}>
      <HowThisWorksLink featureKey="createDish" label="How It Works" />
    </form>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Watch tutorial: How It Works" }));
  expect(submit).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledWith(TUTORIAL_VIDEO_REGISTRY.createDish, "_blank", "noopener,noreferrer");
});

test.each(Object.entries(TUTORIAL_VIDEO_REGISTRY).filter(([, url]) => !url))(
  "%s has no active control or unrelated default when its link is missing",
  feature => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(<HowThisWorksLink featureKey={feature as TutorialFeature} label="Tutorial" />);
    expect(container.innerHTML).toBe("");
    expect(open).not.toHaveBeenCalled();
  },
);
