import type { ReactNode } from "react";

/** A stable sheet compartment: async settings must not move navigation targets.
 * Long schedules and expanded diagnostics scroll here, not over the menu below.
 */
export function MealReminderPanelFrame({
  children,
  isNative,
  label,
}: {
  children: ReactNode;
  isNative: boolean;
  label: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      data-testid="meal-reminder-panel-frame"
      className={`overflow-y-auto overscroll-contain rounded-xl [&>div]:min-h-full ${
        isNative ? "h-[34rem]" : "h-[26rem]"
      }`}
    >
      {children}
    </div>
  );
}
