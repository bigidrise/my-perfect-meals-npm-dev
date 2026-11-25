import { parseMeasurementNumber } from "../../shared/units";

describe("Scientific notation measurement integrity", () => {
  it.each([
    ["1e-7", 0.0000001],
    ["1.25e-7", 0.000000125],
    ["1e-9", 0.000000001],
    ["1E-3", 0.001],
    ["2.5e+2", 250],
    ["0e-400", 0],
    ["-1e-7", -0.0000001],
    ["0,5", 0.5],
    ["1/8", 0.125],
    ["1 1/2", 1.5]
  ])("preserves valid measurement %s", (input, expected) => {
    expect(parseMeasurementNumber(input)).toBe(expected);
  });

  it.each([
    "1e309",
    "-1e309",
    "1e-400",
    "-1e-400",
    "1e",
    "1e+",
    "1e--7",
    "1e-7 extra",
    "1e-7e2",
    "1,5e-7",
    "NaN",
    "Infinity",
    "1/0",
    "0x10",
    "1,000"
  ])("rejects invalid or ambiguous measurement %s", input => {
    expect(parseMeasurementNumber(input)).toBeNull();
  });
});
