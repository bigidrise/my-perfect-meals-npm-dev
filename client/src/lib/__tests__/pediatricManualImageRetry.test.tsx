/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PediatricImageRetry } from "@/components/pediatric/PediatricImageRetry";
import { post } from "@/lib/api";

jest.mock("@/lib/api", () => ({ post: jest.fn() }));
const mockPost = post as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: () => "request-one" });
});

it("never regenerates on mount; a double click makes one request and applies the saved result", async () => {
  let finish!: (value: any) => void;
  mockPost.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const done = jest.fn();
  render(<PediatricImageRetry mealId="saved" childProfileId="child" onRecovered={done} />);
  expect(mockPost).not.toHaveBeenCalled();
  const button = screen.getByRole("button", { name: "Regenerate Image" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenCalledWith(
    "/api/my-perfect-beginning/generated-meals/saved/regenerate-image",
    { childProfileId: "child", requestId: "request-one" },
  );
  expect(button).toBeDisabled();
  const result = { imageUrl: "/public-objects/test/parfait.png", imagePersisted: true, imageGeneration: { status: "generated" } };
  finish(result);
  await waitFor(() => expect(done).toHaveBeenCalledWith(result));
});

it("keeps the same operation ID after a lost response, and reports failure without automatic retries", async () => {
  mockPost.mockRejectedValue(new Error("Network unavailable"));
  render(<PediatricImageRetry mealId="saved" childProfileId="child" onRecovered={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Regenerate Image" }));
  await screen.findByText("Network unavailable");
  expect(mockPost).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Regenerate Image" }));
  await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
  expect(mockPost.mock.calls[0][1].requestId).toBe(mockPost.mock.calls[1][1].requestId);
});

it("does not apply a late response after switching away from the saved meal", async () => {
  let finish!: (value: any) => void;
  mockPost.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const done = jest.fn();
  const view = render(<PediatricImageRetry mealId="saved" childProfileId="child" onRecovered={done} />);
  fireEvent.click(screen.getByRole("button", { name: "Regenerate Image" }));
  view.unmount();
  finish({ imageUrl: "photo", imagePersisted: true });
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
});
