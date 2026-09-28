/** @jest-environment jsdom */

import fs from "node:fs";
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreatorConceptCards } from "@/components/one-touch/CreatorConceptCards";
import { CreatorMenuRestorationProgress } from "@/components/one-touch/CreatorMenuRestorationProgress";
import { useCreatorConceptMenu } from "../useCreatorConceptMenu";
import type { OneTouchCreator } from "@shared/oneTouch";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));

const choices = {
  servings: 3,
  cuisine: { mode: "explicit" as const, value: "italian" },
  eatingStyle: { mode: "explicit" as const, value: "vegan" },
};
const ideas = (prefix: string) => [1, 2, 3].map((n) => ({
  id: `${prefix}-${n}`, title: `${prefix} idea ${n}`, description: "A governed idea",
  primaryIngredients: ["tomatoes", "lentils"], cuisine: "Italian", preparationMethod: "simmered",
}));
const response = (payload: unknown, status = 200) => ({
  ok: status < 400, status, json: async () => payload,
});
const key = (creator: OneTouchCreator) => `oneTouch.conceptChoices.${creator}.owner-1.v1`;

function MenuView({ creator }: { creator: OneTouchCreator }) {
  const menu = useCreatorConceptMenu(creator, "owner-1");
  const [finished, setFinished] = useState(false);
  return (
    <>
      {menu.restoring && !finished && <CreatorMenuRestorationProgress />}
      {!menu.restoring && !finished && (
        <CreatorConceptCards
          concepts={menu.concepts}
          choosingId={menu.choosingId}
          generating={menu.generating}
          onChoose={(id) => { void menu.choose(id).then(() => setFinished(true)).catch(() => undefined); }}
          onTryMore={() => { if (menu.choices) void menu.generate(menu.choices); }}
          onClear={menu.clear}
        />
      )}
      {finished && <button onClick={() => setFinished(false)}>Delete finished recipe</button>}
    </>
  );
}

describe.each(["create_a_dish", "craving_creator"] as const)("%s restoration progress", (creator) => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(global, "fetch", { configurable: true, writable: true, value: jest.fn() });
  });

  it("shows bouncing dots on the first paint, never stale concepts, then displays the exact restored three", async () => {
    localStorage.setItem(key(creator), JSON.stringify(choices));
    let resolve!: (value: any) => void;
    const pending = new Promise<any>((done) => { resolve = done; });
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() => pending);
    render(<MenuView creator={creator} />);
    const loading = screen.getByRole("status", { name: "Loading your ideas" });
    expect(loading.querySelectorAll('div[style*="thinkingBounce"]')).toHaveLength(3);
    expect(screen.getByText("Loading your ideas")).toBeTruthy();
    expect(screen.queryByText("saved idea 1")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(response({ concepts: ideas("saved") })); await pending; });
    await waitFor(() => expect(screen.queryByRole("status", { name: "Loading your ideas" })).toBeNull());
    expect(screen.getAllByRole("button", { name: "Choose This" })).toHaveLength(3);
    expect(screen.getByText("saved idea 1")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no regeneration on restoration
  });

  it.each([
    ["no matching set", response({ concepts: [] })],
    ["restore error", response({ error: "Unable to verify choices" }, 503)],
  ])("%s removes the dots and returns to the empty state", async (_name, result) => {
    localStorage.setItem(key(creator), JSON.stringify(choices));
    let resolve!: (value: any) => void;
    const pending = new Promise<any>((done) => { resolve = done; });
    jest.spyOn(global, "fetch").mockImplementation(() => pending);
    render(<MenuView creator={creator} />);
    expect(screen.getByRole("status", { name: "Loading your ideas" })).toBeTruthy();
    await act(async () => { resolve(result); await pending; });
    await waitFor(() => expect(screen.queryByRole("status", { name: "Loading your ideas" })).toBeNull());
    expect(screen.queryByRole("button", { name: "Choose This" })).toBeNull();
  });

  it("keeps Try 3 More, Choose This, and delete-to-reveal independent of restoration", async () => {
    localStorage.setItem(key(creator), JSON.stringify(choices));
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(response({ concepts: ideas("saved") }) as any)
      .mockResolvedValueOnce(response({ concepts: ideas("new") }) as any)
      .mockResolvedValueOnce(response({ meal: { name: "Completed" } }) as any);
    render(<MenuView creator={creator} />);
    await screen.findByText("saved idea 1");
    fireEvent.click(screen.getByRole("button", { name: "Try 3 More" }));
    await screen.findByText("new idea 1");
    expect(screen.queryByText("saved idea 1")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Choose This" })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: "Choose This" })[1]);
    await screen.findByRole("button", { name: "Delete finished recipe" });
    expect(JSON.parse(fetchMock.mock.calls[2][1]!.body as string).conceptId).toBe("new-2");
    fireEvent.click(screen.getByRole("button", { name: "Delete finished recipe" }));
    expect(screen.getByText("new idea 1")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Choose This" })).toHaveLength(3);
  });

  it("does not show a finished recipe while Choose This is pending or after a failed selection", async () => {
    localStorage.setItem(key(creator), JSON.stringify(choices));
    let rejectChoose!: (error: Error) => void;
    const pending = new Promise<any>((_resolve, reject) => { rejectChoose = reject; });
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(response({ concepts: ideas("saved") }) as any)
      .mockImplementationOnce(() => pending)
      .mockResolvedValueOnce(response({ concepts: ideas("saved") }) as any);
    const { unmount } = render(<MenuView creator={creator} />);
    await screen.findByText("saved idea 1");
    fireEvent.click(screen.getAllByRole("button", { name: "Choose This" })[0]);
    expect(screen.queryByRole("button", { name: "Delete finished recipe" })).toBeNull();
    expect(screen.getByText("Completing your recipe…")).toBeTruthy();
    await act(async () => { rejectChoose(new Error("Failed selection")); try { await pending; } catch { /* expected */ } });
    expect(screen.queryByRole("button", { name: "Delete finished recipe" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Choose This" })).toHaveLength(3);
    unmount();
    render(<MenuView creator={creator} />);
    await screen.findByText("saved idea 1");
    expect(fetchMock).toHaveBeenCalledTimes(3); // restore, choose, restore; never generate
  });
});

it.each([
  "client/src/pages/lifestyle/CreateDishPage.tsx",
  "client/src/pages/craving-creator.tsx",
])("%s wires the same restoration treatment separately from generation and completion", (file) => {
  const source = fs.readFileSync(file, "utf8");
  expect(source).toContain("conceptMenu.restoring && !oneTouchBusy && !isPlatingMeal");
  expect(source).toContain("<CreatorMenuRestorationProgress />");
  expect(source).toContain("!conceptMenu.restoring && !isPlatingMeal");
  expect(source).toContain("onTryMore={() =>");
  expect(source).toContain("onChoose={(id) =>");
  expect(source).toContain("setGeneratedMeals([])");
});

it.each([
  ["client/src/pages/lifestyle/CreateDishPage.tsx", "setGeneratedInSession(true)"],
  ["client/src/pages/craving-creator.tsx", "setGeneratedMeals([meal])"],
])("%s only marks a finished recipe after Choose This succeeds", (file, successState) => {
  const source = fs.readFileSync(file, "utf8");
  const start = source.indexOf("const handleOneTouchChoose = async");
  const chooseHandler = source.slice(start, source.indexOf("\n  };", start));
  expect(start).toBeGreaterThan(-1);
  expect(chooseHandler.indexOf("await conceptMenu.choose")).toBeGreaterThan(-1);
  expect(chooseHandler.indexOf(successState)).toBeGreaterThan(chooseHandler.indexOf("await conceptMenu.choose"));
  expect(chooseHandler).toContain("catch (error");
});