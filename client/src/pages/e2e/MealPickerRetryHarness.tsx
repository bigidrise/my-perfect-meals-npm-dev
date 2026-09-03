import { useState } from "react";
import CravingPicker from "@/components/CravingPicker";
import FixedMenuPicker from "@/components/FixedMenuPicker";

type PickerKind = "craving" | "fixed" | null;

/**
 * Browser-test harness for the standalone picker components.
 *
 * These components are not mounted by a production route, so Playwright needs
 * a controlled way to exercise their visible retry behavior. The route is
 * guarded by the browser automation flag and its test intercepts every meal
 * generation request before it can leave the browser.
 */
export default function MealPickerRetryHarness() {
  const [picker, setPicker] = useState<PickerKind>(null);

  if (typeof navigator === "undefined" || !navigator.webdriver) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="text-2xl font-semibold">Meal picker retry test harness</h1>
      <p className="mt-2 text-sm text-slate-300">
        Open a picker to verify its visible retry behavior with mocked responses.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="open-craving-picker"
          onClick={() => setPicker("craving")}
          className="rounded-md bg-lime-600 px-4 py-2 font-medium hover:bg-lime-500"
        >
          Open Craving Picker
        </button>
        <button
          type="button"
          data-testid="open-fixed-menu-picker"
          onClick={() => setPicker("fixed")}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500"
        >
          Open Fixed Menu Picker
        </button>
      </div>

      <CravingPicker
        open={picker === "craving"}
        slotLabel="Breakfast"
        userId="e2e-picker-user"
        onClose={() => setPicker(null)}
        onUse={() => setPicker(null)}
      />
      <FixedMenuPicker
        open={picker === "fixed"}
        slotLabel="Dinner"
        userId="e2e-picker-user"
        onClose={() => setPicker(null)}
        onSave={() => setPicker(null)}
      />
    </main>
  );
}
