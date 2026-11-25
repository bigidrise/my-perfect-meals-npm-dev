import { parseMeasurementNumber } from "@shared/units";

export function formatAmount(value: number | string | undefined | null): string {
  if (value == null || value === "") return "";
  const number = parseMeasurementNumber(value);
  if (number === null) return String(value);
  return String(Number(number.toPrecision(15)));
}
