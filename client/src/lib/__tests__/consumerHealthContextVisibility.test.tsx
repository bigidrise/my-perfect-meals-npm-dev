/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import {
  CONSUMER_HEALTH_CONTEXT_VISIBLE,
  ConsumerHealthContextSection,
} from "@/components/profile/ConsumerHealthContextSection";

it("keeps the entire consumer support card hidden without affecting adjacent settings", () => {
  render(
    <>
      <p>Other profile settings</p>
      <ConsumerHealthContextSection>
        <section aria-label="Health and nutrition support settings">
          <h2>Health &amp; Nutrition Support</h2>
          <p>Health information needing review</p>
          <button>Earlier Support Information</button>
          <button>Confirm an Exact Restriction</button>
        </section>
      </ConsumerHealthContextSection>
      <p>Manage Safety PIN</p>
    </>,
  );
  expect(CONSUMER_HEALTH_CONTEXT_VISIBLE).toBe(false);
  expect(screen.queryByRole("region", { name: "Health and nutrition support settings" })).toBeNull();
  expect(screen.queryByText("Health information needing review")).toBeNull();
  expect(screen.queryByRole("button", { name: "Earlier Support Information" })).toBeNull();
  expect(screen.getByText("Other profile settings")).toBeTruthy();
  expect(screen.getByText("Manage Safety PIN")).toBeTruthy();
});