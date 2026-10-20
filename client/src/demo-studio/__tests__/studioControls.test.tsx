/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import StudioControls, { type DemoWorkflow } from "../StudioControls";

describe("Demo walkthrough choices stay visible", () => {
  let root: Root;
  let container: HTMLDivElement;
  let actions: {
    onNavigate: jest.Mock; onStartFresh: jest.Mock; onResetCurrent: jest.Mock;
    onResetAll: jest.Mock; onReturn: jest.Mock; onEnter: jest.Mock; onResetDemo: jest.Mock;
  };
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    actions = {
      onNavigate: jest.fn(), onStartFresh: jest.fn(), onResetCurrent: jest.fn(),
      onResetAll: jest.fn(), onReturn: jest.fn(), onEnter: jest.fn(), onResetDemo: jest.fn(),
    };
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  async function render(workflow: DemoWorkflow | null) {
    await act(async () => root.render(<StudioControls {...actions} workflow={workflow}
      name="Demo User" calories={2740} blockedRequests={[]} />));
  }
  function button(label: string, scope: ParentNode = container): HTMLButtonElement {
    const found = Array.from(scope.querySelectorAll("button")).find(b => b.textContent === label);
    expect(found).toBeDefined();
    return found!;
  }
  async function click(target: HTMLButtonElement) { await act(async () => target.click()); }

  it.each([null, "onboarding", "macro", "dashboard"] as const)(
    "keeps all three workflows outside collapsible sections when current workflow is %s",
    async workflow => {
      await render(workflow);
      for (const title of ["Onboarding", "Macro calculator", "Member dashboard"]) {
        const choice = Array.from(container.querySelectorAll("h2, button")).find(el => el.textContent === title);
        expect(choice).toBeDefined();
        expect(choice!.closest("details, [hidden]")).toBeNull();
      }
    },
  );

  it("preserves Start Fresh and Continue demo for each workflow", async () => {
    await render(null);
    for (const workflow of ["onboarding", "macro", "dashboard"]) {
      const row = container.querySelector(`[aria-labelledby="ds-${workflow}-title"]`)!;
      await click(button("Continue demo", row));
      expect(actions.onNavigate).toHaveBeenLastCalledWith(workflow);
      await click(button("Start Fresh", row));
      expect(actions.onStartFresh).toHaveBeenLastCalledWith(workflow);
    }
    await click(button("Enter Demo Mode"));
    expect(actions.onEnter).toHaveBeenCalledTimes(1);
  });

  it("preserves navigation, reset, and return actions inside Demo Mode", async () => {
    await render("dashboard");
    for (const [title, workflow] of [["Onboarding", "onboarding"], ["Macro calculator", "macro"], ["Member dashboard", "dashboard"]]) {
      await click(button(title));
      expect(actions.onNavigate).toHaveBeenLastCalledWith(workflow);
    }
    for (const [label, callback] of [
      ["Reset Current Demo", actions.onResetCurrent], ["Reset All Demo Data", actions.onResetAll],
      ["Reset Demo", actions.onResetDemo], ["Return to Demo Studio", actions.onReturn],
    ] as const) {
      const target = button(label);
      expect(target.closest("details")).toBeNull();
      await click(target);
      expect(callback).toHaveBeenCalledTimes(1);
    }
    expect(actions.onStartFresh).not.toHaveBeenCalled();
  });

  it("shows workflow cards again after returning and remounting the chooser", async () => {
    await render("onboarding");
    await click(button("Return to Demo Studio"));
    await render(null);
    expect(container.querySelector(".ds-workflows")?.closest("details")).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(container);
    await render(null);
    expect(container.querySelectorAll(".ds-workflow")).toHaveLength(3);
    expect(container.querySelector(".ds-workflows")?.closest("details")).toBeNull();
    expect(actions.onResetAll).not.toHaveBeenCalled();
    expect(actions.onStartFresh).not.toHaveBeenCalled();
  });

  it("uses one compact control area during a walkthrough and full cards in Studio", async () => {
    await render("onboarding");
    expect(container.querySelector(".demo-studio")?.classList.contains("ds-session")).toBe(true);
    expect(container.querySelector(".ds-session-body")).not.toBeNull();
    expect(container.querySelector(".ds-topbar")).toBeNull();
    expect(container.querySelector('[aria-label="Demo workflow navigation"]')?.closest(".ds-session-body")).not.toBeNull();
    expect(container.querySelector('[aria-label="Demo controls"]')?.closest(".ds-session-body")).not.toBeNull();
    expect(container.querySelector(".ds-divider")).toBeNull();
    await render(null);
    expect(container.querySelector(".ds-topbar")).not.toBeNull();
    expect(container.querySelectorAll(".ds-workflow")).toHaveLength(3);
    expect(container.querySelector(".ds-session-body")).toBeNull();
  });
});
