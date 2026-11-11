/** @jest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import GetawayAvailabilityNotice from "@/components/away-from-home/GetawayAvailabilityNotice";
import type { GetawayAvailability } from "@shared/getawayAvailability";

afterEach(cleanup);

const availability: GetawayAvailability = {
  status: "listings_found",
  summary: "Possible listings near the requested terminal; ask staff to confirm access.",
  preferences: { cuisine: "Korean", diets: ["vegan"] },
  restaurants: [{
    name: "Fixture Dining",
    address: "Ontario International Airport area",
    menuStatus: "unverified",
    menuNote: "No verified menu; confirm ingredients and preparation with staff.",
  }],
};

test("lists restaurant evidence and saved preferences without certifying terminal access or menu safety", () => {
  render(<GetawayAvailabilityNotice availability={availability} />);
  expect(screen.getByRole("region", { name: "Possible dining listings" })).toBeTruthy();
  expect(screen.getByText("Fixture Dining")).toBeTruthy();
  expect(screen.getByText(availability.restaurants[0].address)).toBeTruthy();
  expect(screen.getByText(/Preferences considered: Korean · vegan/)).toBeTruthy();
  expect(screen.getByText("Location and menu need confirmation.")).toBeTruthy();
  expect(screen.getByText(availability.restaurants[0].menuNote)).toBeTruthy();
});

test.each(["unavailable", "no_matches_found", "location_required"] as const)(
  "%s displays the supplied uncertainty explanation, not invented restaurant listings", status => {
    const summary = "Search information is incomplete; this does not prove no suitable food exists.";
    render(<GetawayAvailabilityNotice availability={{ ...availability, status, summary, restaurants: [] }} />);
    expect(screen.getByText(summary)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("Fixture Dining")).toBeNull();
  },
);
