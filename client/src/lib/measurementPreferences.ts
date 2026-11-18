import type { MeasurementPreference } from "@shared/units";

type MeasurementAccount = { id: string; measurementSystem?: string; countryCode?: string };

/** Transport-injected so both existing forms share checked, account-bound saves. */
export async function saveMeasurementPreferences(
  selection: { measurementSystem: MeasurementPreference; countryCode: string; accountId: string },
  actions: {
    request: (payload: { measurementSystem: MeasurementPreference; countryCode: string }) => Promise<{ ok: boolean }>;
    refresh: () => Promise<MeasurementAccount | null>;
    isCurrentAccount: () => boolean;
    message: (key: "saveFailed" | "refreshFailed") => string;
  },
) {
  const { accountId, measurementSystem, countryCode } = selection;
  if (!actions.isCurrentAccount()) throw new Error(actions.message("saveFailed"));
  try {
    const response = await actions.request({ measurementSystem, countryCode });
    if (!response.ok) throw new Error("save rejected");
  } catch {
    throw new Error(actions.message("saveFailed"));
  }
  if (!actions.isCurrentAccount()) throw new Error(actions.message("refreshFailed"));
  let account: MeasurementAccount | null;
  try { account = await actions.refresh(); }
  catch { throw new Error(actions.message("refreshFailed")); }
  if (!actions.isCurrentAccount() || account?.id !== accountId ||
      account.measurementSystem !== measurementSystem || account.countryCode !== countryCode) {
    throw new Error(actions.message("refreshFailed"));
  }
  return account;
}
