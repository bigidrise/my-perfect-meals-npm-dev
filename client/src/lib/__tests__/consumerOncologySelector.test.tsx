/** @jest-environment jsdom */
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { OncologySymptomSelector, useConsumerOncologySelection } from "../../components/OncologySymptomSelector";

const saved = { enabled: true, symptoms: ["nausea"], emphasis: { highProteinNutrientDensity: false }, source: "self", locked: false };
test("renders existing five symptoms plus exclusive None currently", () => {
  const onChange = jest.fn();
  const { rerender } = render(<OncologySymptomSelector symptoms={[]} onChange={onChange} />);
  expect(screen.getAllByRole("checkbox")).toHaveLength(6);
  expect((screen.getByLabelText("None currently") as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText("Low appetite"));
  expect(onChange).toHaveBeenLastCalledWith(["low_appetite"]);
  rerender(<OncologySymptomSelector symptoms={["low_appetite", "nausea"]} onChange={onChange} />);
  expect((screen.getByLabelText("None currently") as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByLabelText("None currently"));
  expect(onChange).toHaveBeenLastCalledWith([]);
});
test("physician controls stay read-only", () => {
  render(<OncologySymptomSelector symptoms={["nausea"]} readOnly onChange={jest.fn()} />);
  expect(screen.getAllByRole("checkbox").every(input => (input as HTMLInputElement).disabled)).toBe(true);
});
test("self selection edits and central refresh restores the authoritative response", () => {
  const { result, rerender } = renderHook(({ context }) => useConsumerOncologySelection(context), { initialProps: { context: saved } });
  expect(result.current.symptoms).toEqual(["nausea"]);
  act(() => result.current.setSymptoms(["nausea", "low_appetite"]));
  expect(result.current.changed).toBe(true);
  expect(result.current.payload()).toEqual({ symptoms: ["nausea", "low_appetite"] });
  rerender({ context: { ...saved, symptoms: ["nausea", "low_appetite"] } });
  expect(result.current.changed).toBe(false);
  rerender({ context: { ...saved, enabled: false, symptoms: ["nausea", "low_appetite"] } });
  expect(result.current.symptoms).toEqual(["nausea", "low_appetite"]);
});
test("physician source cannot produce a consumer payload or change answers", () => {
  const { result } = renderHook(() => useConsumerOncologySelection({ ...saved, source: "physician", locked: false }));
  act(() => result.current.setSymptoms([]));
  expect(result.current.symptoms).toEqual(["nausea"]);
  expect(result.current.payload()).toBeUndefined();
});
test("malformed stored state fails closed instead of clearing it", () => {
  const { result } = renderHook(() => useConsumerOncologySelection({ ...saved, symptoms: ["unknown"] }));
  expect(result.current.readOnly).toBe(true);
  expect(() => result.current.payload()).toThrow("could not be verified");
});
