/** @jest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { apiRequest } from "@/lib/apiRequest";
import { savedMacroSetupComplete, useSavedMacroSetup } from "../useSavedMacroSetup";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
const saved = { hasTargets: true, calories: 1800, protein_g: 140, carbs_g: 0, fat_g: 70 };
beforeEach(() => { request.mockReset(); localStorage.clear(); });

test("complete server-backed targets include valid zero carbohydrates", () => {
  expect(savedMacroSetupComplete(saved)).toBe(true);
  expect(savedMacroSetupComplete({ hasTargets: false })).toBe(false);
});

test.each([null, {}, { ...saved, calories: 0 }, { ...saved, protein_g: null },
  { ...saved, fat_g: -1 }, { ...saved, carbs_g: NaN }])(
  "malformed or unconfirmed saved values are not treated as incomplete: %p", value => {
    expect(() => savedMacroSetupComplete(value)).toThrow();
  },
);

test("reads the exact account without cache; browser drafts and seen flags are not completion", async () => {
  localStorage.setItem("macro_calculator_settings", JSON.stringify({ goal: "maint" }));
  localStorage.setItem("mpm.macroTargets.anon", JSON.stringify(saved));
  localStorage.setItem("quick-tour::macro-calculator", "seen");
  request.mockResolvedValue({ hasTargets: false });
  const { result } = renderHook(() => useSavedMacroSetup("account-a"));
  expect(result.current.complete).toBeNull();
  await waitFor(() => expect(result.current.complete).toBe(false));
  expect(request).toHaveBeenCalledWith("/api/users/account-a/macro-targets",
    expect.objectContaining({ method: "GET", cache: "no-store", signal: expect.any(AbortSignal) }));
});

test("saved targets suppress initial setup on every new visit", async () => {
  request.mockResolvedValue(saved);
  const first = renderHook(() => useSavedMacroSetup("account-a"));
  await waitFor(() => expect(first.result.current.complete).toBe(true));
  first.unmount();
  const second = renderHook(() => useSavedMacroSetup("account-a"));
  await waitFor(() => expect(second.result.current.complete).toBe(true));
  expect(request).toHaveBeenCalledTimes(2);
});

test("read failures remain unknown with a visible error message, not false completion", async () => {
  request.mockRejectedValue(new Error("unavailable"));
  const { result } = renderHook(() => useSavedMacroSetup("account-a"));
  await waitFor(() => expect(result.current.error).toMatch(/couldn't be checked/));
  expect(result.current.complete).toBeNull();
});

test("successful save cannot be overwritten by an older unfinished read", async () => {
  let resolve!: (value: unknown) => void;
  request.mockImplementation(() => new Promise(r => { resolve = r; }));
  const { result } = renderHook(() => useSavedMacroSetup("account-a"));
  act(() => result.current.markSaved());
  await act(async () => resolve({ hasTargets: false }));
  expect(result.current.complete).toBe(true);
});

test("account switches hide stale evidence and reject late old-account responses or saves", async () => {
  let resolveFirst!: (value: unknown) => void;
  request.mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }))
    .mockResolvedValueOnce({ hasTargets: false });
  const { result, rerender } = renderHook(({ id }) => useSavedMacroSetup(id),
    { initialProps: { id: "account-a" } });
  const oldSave = result.current.markSaved;
  rerender({ id: "account-b" });
  expect(result.current.complete).toBeNull();
  act(() => oldSave());
  await act(async () => resolveFirst(saved));
  await waitFor(() => expect(result.current.complete).toBe(false));
});

test("disabled scope performs no read or completion write", () => {
  const { result } = renderHook(() => useSavedMacroSetup(null));
  act(() => result.current.markSaved());
  expect(request).not.toHaveBeenCalled();
  expect(result.current.complete).toBeNull();
});
