import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useConsumerCopy } from "./useConsumerCopy";
import { macroCalculatorSpanish } from "./macroCalculatorCopy";

/** Source-owned calculator interface copy; never translate saved values or payloads. */
export function useMacroCalculatorCopy(namespace?: string) {
  const legacy = useConsumerCopy(namespace);
  const calculator = useTranslation("macroCalculatorCopy");
  const t = useCallback((key: string, options?: Record<string, unknown>) => {
    const stage = /^Stage (\d+) of (\d+)( · Explanation replay)?$/.exec(key);
    if (stage) return calculator.t("Stage {{current}} of {{total}}", {
      current: stage[1], total: stage[2], keySeparator: false, nsSeparator: false,
    }) + (stage[3] ? calculator.t(" · Explanation replay", { keySeparator: false, nsSeparator: false }) : "");
    return Object.hasOwn(macroCalculatorSpanish, key)
      ? calculator.t(key, { ...options, keySeparator: false, nsSeparator: false })
      : legacy.t(key, options as any);
  },
  [calculator.t, legacy.t]) as typeof legacy.t;
  return { ...legacy, t };
}
