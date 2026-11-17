import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { consumerEnglish } from "./consumerJourney";

/**
 * Explicit source-key calls for the approved consumer copy; existing catalog
 * keys keep their original namespace. Never scan/replace rendered DOM or data.
 */
export function useConsumerCopy(namespace?: string) {
  const legacy = useTranslation(namespace);
  const journey = useTranslation("consumerJourney");
  const t = useCallback((key: string, options?: Record<string, unknown>) =>
    Object.prototype.hasOwnProperty.call(consumerEnglish, key)
      ? journey.t(key, { ...options, keySeparator: false, nsSeparator: false })
      : legacy.t(key, { defaultValue: key, ...options } as any)
  , [journey.t, legacy.t]) as typeof legacy.t;
  return { ...legacy, t };
}
