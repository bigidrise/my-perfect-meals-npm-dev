/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AntiInflammatorySupportControl } from "@/components/profile/AntiInflammatorySupportControl";
import fs from "node:fs";
import path from "node:path";
const mockAPI = jest.fn();
jest.mock("@/lib/apiRequest", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));
const endpoint = "/api/health-context/support/anti_inflammatory";
const renderControl = (userId = "account-a") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (id: string) => <QueryClientProvider client={client}><AntiInflammatorySupportControl userId={id} /></QueryClientProvider>;
  const view = render(wrap(userId));
  return { ...view, switchAccount: (id: string) => view.rerender(wrap(id)), client };
};
beforeEach(() => mockAPI.mockReset());

test("Edit Profile exposes the Development-only control outside the still-hidden clinical review section", () => {
  const source = fs.readFileSync(path.resolve("client/src/pages/profile/EditProfilePage.tsx"), "utf8");
  const control = source.indexOf("<AntiInflammatorySupportControl ");
  const pausedReview = source.indexOf("<ConsumerHealthContextSection>");
  expect(control).toBeGreaterThan(-1);
  expect(control).toBeLessThan(pausedReview);
  expect(source.slice(control - 130, control)).toContain("import.meta.env.DEV && ANTI_INFLAMMATORY_SUPPORT_DEVELOPMENT_ENABLED && user?.id");
  const consumerGate = fs.readFileSync(path.resolve("client/src/components/profile/ConsumerHealthContextSection.tsx"), "utf8");
  expect(consumerGate).toContain("CONSUMER_HEALTH_CONTEXT_VISIBLE = false");
});

test.each(["General Nutrition", "Diabetic", "GLP-1"])("independent activation and deactivation preserve %s and do not write program fields", async () => {
  mockAPI.mockResolvedValueOnce({ enabled: false, legacyPreferenceSaved: false })
    .mockResolvedValueOnce({ enabled: true, legacyPreferenceSaved: true })
    .mockResolvedValueOnce({ enabled: false, legacyPreferenceSaved: false });
  renderControl();
  fireEvent.click(await screen.findByRole("button", { name: "Enable Anti-Inflammatory support" }));
  expect(await screen.findByText("Optional support: On")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: /Turn off Anti/ }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /Turn off Anti/ }));
  expect(await screen.findByText("Optional support: Off")).toBeTruthy();
  const writes = mockAPI.mock.calls.filter(([, options]) => options?.method === "PUT");
  expect(writes.map(([path, options]) => [path, JSON.parse(options.body)])).toEqual([
    [endpoint, { enabled: true }], [endpoint, { enabled: false }],
  ]);
});
test("a historical preference stays off until explicit confirmation", async () => {
  mockAPI.mockResolvedValue({ enabled: false, legacyPreferenceSaved: true });
  renderControl();
  expect(await screen.findByText(/earlier preference is saved but is not active/i)).toBeTruthy();
  expect(mockAPI).toHaveBeenCalledTimes(1);
});
test("late previous-account responses cannot activate the next account", async () => {
  let finish!: (value: unknown) => void;
  mockAPI.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce({ enabled: false, legacyPreferenceSaved: false });
  const view = renderControl();
  view.switchAccount("account-b");
  expect(await screen.findByText("Optional support: Off")).toBeTruthy();
  await act(async () => finish({ enabled: true, legacyPreferenceSaved: true }));
  expect(screen.queryByText("Optional support: On")).toBeNull();
  expect(screen.getByText("Optional support: Off")).toBeTruthy();
});
test("failed saves do not claim success and require reloading authoritative state", async () => {
  mockAPI.mockResolvedValueOnce({ enabled: false, legacyPreferenceSaved: false })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ enabled: true, legacyPreferenceSaved: true });
  renderControl();
  fireEvent.click(await screen.findByRole("button", { name: "Enable Anti-Inflammatory support" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Optional support: On")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reload settings" }));
  expect(await screen.findByText("Optional support: On")).toBeTruthy();
});
