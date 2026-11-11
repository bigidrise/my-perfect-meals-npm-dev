/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CoachCornerCard from "@/components/ace/CoachCornerCard";

const mockNavigate = jest.fn();
let mockStatus: { completed: boolean } | undefined;
jest.mock("wouter", () => ({ useLocation: () => ["/dashboard", mockNavigate] }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: mockStatus }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => true }));

test.each([
  [undefined, "/coach-corner/welcome"],
  [{ completed: false }, "/coach-corner/welcome"],
  [{ completed: true }, "/coach-corner/home"],
])("presentation remains independent of status and preserves navigation: %s", (status, path) => {
  mockStatus = status as { completed: boolean } | undefined;
  render(<CoachCornerCard />);
  const images = screen.getAllByRole("img");
  expect(images).toHaveLength(2);
  expect(images[0]).toHaveAttribute("srcset", expect.stringContaining("ask-chef-desk-240.webp"));
  expect(images[1]).toHaveAttribute("src", "/assets/ask-chef-wordmark.webp");
  fireEvent.click(screen.getByRole("button", { name: "Open Ask Chef" }));
  expect(mockNavigate).toHaveBeenCalledWith(path);
});
