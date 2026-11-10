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
    fireEvent.click(screen.getByRole("button", { name: "Watch tutorial: How It Works" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
  },
);

test.each(Object.entries(TUTORIAL_VIDEO_REGISTRY).filter(([, url]) => !url))(
  "%s has no active control or unrelated default when its link is missing",
  feature => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(<HowThisWorksLink featureKey={feature as TutorialFeature} label="Tutorial" />);
    expect(container.innerHTML).toBe("");
    expect(open).not.toHaveBeenCalled();
  },
);
