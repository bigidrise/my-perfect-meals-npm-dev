/** Keep the calculator's written help independent of the paused Copilot/voice UI. */
export function isCalculatorCopilotPaused(pathname: string): boolean {
  return pathname.split(/[?#]/)[0].replace(/\/+$/, "") === "/macro-counter";
}
