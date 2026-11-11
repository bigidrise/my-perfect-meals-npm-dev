/** @jest-environment jsdom */
import fs from "node:fs";
import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useCreatorConceptMenu } from "../useCreatorConceptMenu";
import { CreatorConceptCards } from "@/components/one-touch/CreatorConceptCards";
import { CreatorMenuRecovery } from "@/components/one-touch/CreatorMenuRecovery";
import i18n from "@/i18n";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));

const key = "oneTouch.conceptChoices.create_a_dish.owner-1.v1";
const choices = { servings: 2, cuisine: { mode: "profile" as const }, eatingStyle: { mode: "profile" as const } };
const ideas = [1, 2, 3].map(n => ({
  id: `idea-${n}`, title: `Dish ${n}`, description: "A recipe idea",
  primaryIngredients: ["beans"], cuisine: "American", preparationMethod: "baked",
}));
const response = (payload: unknown, status = 200) => ({
  ok: status < 400, status, json: async () => payload,
});

function RecoveryView() {
  const menu = useCreatorConceptMenu("create_a_dish", "owner-1", { recoverSavedChoices: true });
  return <>
    <CreatorMenuRecovery error={menu.restoreError} busy={menu.restoring} onRetry={menu.retryRestore} />
    <CreatorConceptCards concepts={menu.concepts} choosingId={menu.choosingId}
      generating={menu.generating} choosingBlocked={Boolean(menu.restoreError)}
      onChoose={id => { void menu.choose(id).catch(() => {}); }}
      onTryMore={() => { void menu.generate(choices); }} onClear={menu.clear} />
  </>;
}

beforeEach(() => {
  void i18n.changeLanguage("en");
  localStorage.clear();
  jest.restoreAllMocks();
  Object.defineProperty(global, "fetch", { configurable: true, writable: true, value: jest.fn() });
});

test("recovery controls use translated labels without changing retry behavior", async () => {
  const onRetry = jest.fn();
  await i18n.changeLanguage("es");
  const view = render(<CreatorMenuRecovery error="Server-provided detail" busy={false} onRetry={onRetry} />);
  expect(screen.getByText("Tu menú necesita otra comprobación")).toBeTruthy();
  expect(screen.getByText("Server-provided detail")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Volver a comprobar las opciones guardadas" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  view.rerender(<CreatorMenuRecovery error="Server-provided detail" busy onRetry={onRetry} />);
  expect((screen.getByRole("button", { name: "Comprobando las opciones guardadas…" }) as HTMLButtonElement).disabled).toBe(true);
});

test.each([
  ["network failure", () => Promise.reject(new Error("Connection interrupted"))],
  ["service unavailable", () => Promise.resolve(response({ error: "Unable to verify choices" }, 503))],
  ["unverified set", () => Promise.resolve(response({ concepts: [] }))],
])("%s keeps saved choices and exposes a working restore-only retry", async (_name, fail) => {
  localStorage.setItem(key, JSON.stringify(choices));
  const fetchMock = jest.spyOn(global, "fetch")
    .mockImplementationOnce(fail as any)
    .mockResolvedValueOnce(response({ concepts: ideas }) as any);
  render(<RecoveryView />);
  await screen.findByRole("alert");
  expect(localStorage.getItem(key)).toBe(JSON.stringify(choices));
  expect(screen.queryByRole("button", { name: "Choose This" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry saved choices" }));
  await screen.findByText("Dish 1");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getAllByRole("button", { name: "Choose This" })).toHaveLength(3);
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
    "/api/one-touch-create/restore", "/api/one-touch-create/restore",
  ]);
});

test("a conflict preserves the visible ideas but blocks choosing until verification succeeds", async () => {
  localStorage.setItem(key, JSON.stringify(choices));
  const fetchMock = jest.spyOn(global, "fetch")
    .mockResolvedValueOnce(response({ concepts: ideas }) as any)
    .mockResolvedValueOnce(response({ error: "Your food protections changed." }, 409) as any)
    .mockResolvedValueOnce(response({ concepts: ideas }) as any);
  render(<RecoveryView />);
  await screen.findByText("Dish 1");
  fireEvent.click(screen.getAllByRole("button", { name: "Choose This" })[1]);
  await screen.findByRole("alert");
  expect(screen.getByText("Dish 1")).toBeTruthy();
  for (const button of screen.getAllByRole("button", { name: "Choose This" })) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem(key)).toBe(JSON.stringify(choices));
  fireEvent.click(screen.getByRole("button", { name: "Retry saved choices" }));
  await screen.findByText("Dish 1");
  expect(screen.queryByRole("alert")).toBeNull();
  expect((screen.getAllByRole("button", { name: "Choose This" })[0] as HTMLButtonElement).disabled).toBe(false);
});

test("saved choices survive a failed visit and restore on a later visit", async () => {
  localStorage.setItem(key, JSON.stringify(choices));
  jest.spyOn(global, "fetch")
    .mockResolvedValueOnce(response({ concepts: [] }) as any)
    .mockResolvedValueOnce(response({ concepts: ideas }) as any);
  const first = render(<RecoveryView />);
  await screen.findByRole("alert");
  first.unmount();
  render(<RecoveryView />);
  await screen.findByText("Dish 1");
  expect(screen.getAllByRole("button", { name: "Choose This" })).toHaveLength(3);
});

test("explicit clear removes saved choices and prevents a pending retry from restoring them", async () => {
  localStorage.setItem(key, JSON.stringify(choices));
  let settle!: (value: any) => void;
  jest.spyOn(global, "fetch").mockImplementationOnce(() => new Promise(resolve => { settle = resolve; }));
  const { result } = renderHook(() =>
    useCreatorConceptMenu("create_a_dish", "owner-1", { recoverSavedChoices: true }));
  act(() => result.current.clear());
  await act(async () => { settle(response({ concepts: ideas })); });
  expect(result.current.concepts).toEqual([]);
  expect(result.current.restoreError).toBeNull();
  expect(localStorage.getItem(key)).toBeNull();
});

test("changing accounts hides the prior account's choices and recovery notice", async () => {
  localStorage.setItem(key, JSON.stringify(choices));
  jest.spyOn(global, "fetch").mockResolvedValueOnce(response({ concepts: [] }) as any);
  const { result, rerender } = renderHook(({ ownerId }) =>
    useCreatorConceptMenu("create_a_dish", ownerId, { recoverSavedChoices: true }),
    { initialProps: { ownerId: "owner-1" } });
  await waitFor(() => expect(result.current.restoreError).not.toBeNull());
  rerender({ ownerId: "owner-2" });
  expect(result.current.restoreError).toBeNull();
  expect(result.current.concepts).toEqual([]);
  expect(localStorage.getItem(key)).toBe(JSON.stringify(choices));
});

test("recovery is enabled only for Create a Dish, not the other shared-hook consumer", () => {
  const dish = fs.readFileSync("client/src/pages/lifestyle/CreateDishPage.tsx", "utf8");
  const craving = fs.readFileSync("client/src/pages/craving-creator.tsx", "utf8");
  expect(dish).toContain('useCreatorConceptMenu("create_a_dish", user?.id, { recoverSavedChoices: true })');
  expect(dish).toContain("onRetry={conceptMenu.retryRestore}");
  expect(dish).toContain("choosingBlocked={Boolean(conceptMenu.restoreError)}");
  expect(craving).not.toContain("recoverSavedChoices");
});
