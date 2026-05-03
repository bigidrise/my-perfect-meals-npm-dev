import { addDaysISOSafe } from "./midnight";

export function getRollingDays(anchorISO: string, length: number): string[] {
  return Array.from({ length }, (_, i) => addDaysISOSafe(anchorISO, i));
}

export function getRolling7Days(anchorISO: string): string[] {
  return getRollingDays(anchorISO, 7);
}

export function getRolling14Days(anchorISO: string): string[] {
  return getRollingDays(anchorISO, 14);
}
