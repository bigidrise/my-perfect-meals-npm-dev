/** @jest-environment jsdom */
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OncologySymptomDialog, OncologySymptomSummary } from "../../components/OncologySymptomDialog";
import type { OncologySymptomSelection } from "../../../../shared/oncologySupportSelection";

function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [symptoms, setSymptoms] = useState<OncologySymptomSelection[]>(["nausea"]);
  return <>
    <OncologySymptomSummary symptoms={symptoms} onReview={() => setOpen(true)} readOnly={readOnly} />
    <OncologySymptomDialog open={open} onOpenChange={setOpen} symptoms={symptoms}
      onChange={setSymptoms} readOnly={readOnly} saveHint="Save your profile to save these choices." />
  </>;
}

test("review opens an accessible overlay with all existing choices and honest saving instructions", () => {
  render(<Harness />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review symptoms" }));
  const dialog = screen.getByRole("dialog", { name: "What are you currently experiencing?" });
  expect(within(dialog).getAllByRole("checkbox")).toHaveLength(6);
  expect(within(dialog).getByText("Save your profile to save these choices.")).toBeTruthy();
  fireEvent.click(within(dialog).getByLabelText("Low appetite"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Low appetite, Nausea")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Review symptoms" }));
  expect((screen.getByLabelText("Low appetite") as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText("None currently"));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByText("None currently")).toBeTruthy();
});

test("care-team-owned selections can be viewed but not edited in the overlay", () => {
  render(<Harness readOnly />);
  fireEvent.click(screen.getByRole("button", { name: "View symptoms" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getAllByRole("checkbox").every(input => (input as HTMLInputElement).disabled)).toBe(true);
  expect(within(dialog).getByText(/Managed by your care team/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(screen.getByText("Nausea")).toBeTruthy();
});

test("dialog frame is bounded and content uses the shared scrollable modal body", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Review symptoms" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.className).toContain("max-w-sm");
  expect(dialog.className).toContain("100dvh");
  expect(dialog.querySelector(".overflow-y-auto.min-h-0")).not.toBeNull();
});
