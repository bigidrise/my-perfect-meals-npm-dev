import { useCallback } from "react";
import { useConsumerCopy } from "./useConsumerCopy";
import { useHydrationChoiceLabels } from "./useConsumerChoiceLabels";

type Translate = (source: string, options?: Record<string, unknown>) => string;
type Values = Record<string, unknown> | ((translate: Translate) => Record<string, unknown>);

/** Authored notification copy remains live while the toast is mounted.
 * Unknown server details and original records are never passed through here. */
export function ConsumerNotice({ source, values }: { source: string; values?: Values }) {
  const { t } = useConsumerCopy();
  return <>{t(source, typeof values === "function" ? values(t) : values)}</>;
}

export function useConsumerNotice() {
  return useCallback((source: string, values?: Values) => <ConsumerNotice source={source} values={values} />, []);
}

export function FluidLogNotice({ amount, unit, beverageClass }: { amount: number; unit: string; beverageClass: string }) {
  const { t } = useConsumerCopy();
  const labels = useHydrationChoiceLabels();
  return <>{t("{{amount}} {{unit}} of {{beverage}} was added.", { amount, unit, beverage: labels.beverages[beverageClass] ?? beverageClass })}</>;
}
