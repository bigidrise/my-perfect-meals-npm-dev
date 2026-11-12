/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Trash, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TRASH_CONTROL_CLASSES } from "@/lib/trashControlStyles";

test("all supported Lucide trash icons are red without hover, regardless of parent text color", () => {
  const css = fs.readFileSync("client/src/index.css", "utf8");
  const rule = css.match(/svg\.lucide\.lucide-trash,[\s\S]*?\n\}/)?.[0];
  expect(rule).toBeDefined();
  const style = document.createElement("style");
  expect(css.indexOf("svg.lucide.lucide-trash,")).toBeGreaterThan(css.lastIndexOf(".dark .text-gray-400"));
  // Match production order: generic dark-mode fallbacks precede trash policy.
  style.textContent = `.dark .text-gray-400 { color: gray !important; }\n${rule!}`;
  document.head.appendChild(style);
  const view = render(
    <button className="dark" style={{ color: "white" }}><Trash data-testid="trash" /><Trash2 color="white" className="text-gray-400" data-testid="trash-two" /></button>,
  );
  for (const id of ["trash", "trash-two"]) {
    expect(getComputedStyle(screen.getByTestId(id)).color).toBe("rgb(248, 113, 113)");
    expect(getComputedStyle(screen.getByTestId(id)).stroke).toBe("currentColor");
  }
  view.unmount();
  style.remove();
});

test("Pregnancy's shared sheet close uses the compact style and only dismisses the sheet", () => {
  const dismiss = jest.fn();
  render(
    <Sheet open onOpenChange={dismiss}>
      <SheetContent>
        <SheetTitle>Pregnancy settings</SheetTitle>
        <SheetDescription>Existing settings</SheetDescription>
      </SheetContent>
    </Sheet>,
  );
  const close = screen.getByRole("button", { name: "Close" });
  expect(close).toHaveClass("bg-transparent", "text-red-400", "absolute", "min-h-[44px]", "min-w-[44px]");
  expect(close).not.toHaveClass("bg-red-600", "text-white", "relative");
  expect(close.querySelector("svg")).not.toBeNull();
  fireEvent.click(close);
  expect(dismiss).toHaveBeenCalledWith(false);
});

test("shared trash styling keeps the compact visible outline inside an accessible touch target", () => {
  expect(TRASH_CONTROL_CLASSES).toContain("min-h-[44px] min-w-[44px]");
  expect(TRASH_CONTROL_CLASSES).toContain("before:inset-1.5");
  expect(TRASH_CONTROL_CLASSES).not.toContain("bg-red-600");
  expect(TRASH_CONTROL_CLASSES).toContain("focus:ring-2");
});
