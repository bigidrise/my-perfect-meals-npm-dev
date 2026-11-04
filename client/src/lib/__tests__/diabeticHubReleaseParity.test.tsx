/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fireEvent, render, screen } from "@testing-library/react";

// Exercise the actual hub JSX without importing its authenticated queries or
// invoking medication APIs. This checks the presentation boundary, not clinical
// authority or a full signed-in browser journey.
const source = fs.readFileSync(path.resolve("client/src/pages/physician/DiabeticHub.tsx"), "utf8");
const start = source.indexOf("{/* Preserve the released activation entry");
const end = source.indexOf("{/* Doctor / Coach Guardrail Card */}", start);
if (start < 0 || end < 0) throw new Error("Diabetic Hub release section could not be located");
const section = source.slice(start, end).replace(/import\.meta\.env\.DEV/g, "development");
const compiled = ts.transpileModule(`
  function Fixture({ development, active, error = false }) {
    const isGlp1Active = active;
    const t = key => key;
    const setLocation = onNavigate;
    const glp1CurrentUse = { isError: error, refetch: () => {} };
    const [showDailySymptoms, setShowDailySymptoms] = React.useState(false);
    return <>${section}</>;
  }
`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } });
const navigate = jest.fn();
const Pill = ({ variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) =>
  <button {...props} />;
const Fixture = new Function("React", "PillButton", "Button", "GLP1DailyCheckin", "onNavigate",
  `${compiled.outputText}\nreturn Fixture;`)(React, Pill, Pill,
  () => <div data-testid="daily-checkin" />, navigate) as React.ComponentType<{
    development: boolean; active: boolean; error?: boolean;
  }>;

test("Production restores the inactive-member prompt and its existing profile destination", () => {
  render(<Fixture development={false} active={false} />);
  expect(screen.getByText("diabeticHub.glp1NudgeTitle")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "diabeticHub.enableMetabolicMed" }));
  expect(navigate).toHaveBeenCalledWith("/profile/edit");
  expect(screen.queryByText("Update daily GLP-1 symptoms")).toBeNull();
});

test.each([false, true])("Production never renders Development symptoms or status errors, active=%s", active => {
  render(<Fixture development={false} active={active} error />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText("Update daily GLP-1 symptoms")).toBeNull();
  expect(screen.queryByText("diabeticHub.glp1NudgeTitle") !== null).toBe(!active);
});

test("Development keeps the active-member symptom panel and does not restore the old nudge", () => {
  render(<Fixture development active />);
  expect(screen.queryByText("diabeticHub.glp1NudgeTitle")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Update daily GLP-1 symptoms" }));
  expect(screen.getByTestId("daily-checkin")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide daily symptom panel" }));
  expect(screen.queryByTestId("daily-checkin")).toBeNull();
});

test("Development retains medication-status failure feedback without the Production nudge", () => {
  render(<Fixture development active={false} error />);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByText("diabeticHub.glp1NudgeTitle")).toBeNull();
});
