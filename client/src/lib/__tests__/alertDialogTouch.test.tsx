/** @jest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import "@/i18n";
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription,
  AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

afterEach(cleanup);

test.each([false, true])("alert button hover opt-out is local: %s", disableHover => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>Confirmation</AlertDialogTitle>
        <AlertDialogDescription>Test confirmation</AlertDialogDescription>
        <AlertDialogCancel disableHover={disableHover}>Keep</AlertDialogCancel>
        <AlertDialogAction disableHover={disableHover}>Replace</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>,
  );
  for (const button of screen.getByRole("alertdialog").querySelectorAll("button")) {
    expect(button.className.includes("hover:")).toBe(!disableHover);
    expect(button.className).toContain("focus-visible:");
    expect(button).not.toHaveAttribute("disableHover");
  }
});
