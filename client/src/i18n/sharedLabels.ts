import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { Children } from "react";
import en from "./locales/en.json";
import { consumerEnglish } from "./consumerJourney";

// Deliberately bounded to standard interface actions. Never translate arbitrary
// prose, clinical messages, numbers, server errors, or machine identifiers here.
const actionKeys = [
  "save", "cancel", "back", "next", "continue", "done", "close", "submit",
  "loading", "error", "tryAgain", "confirm", "delete", "edit", "add", "remove",
  "search", "filter", "apply", "reset", "yes", "no", "share",
] as const;
const actionKeysByEnglish = new Map<string, string>(
  actionKeys.map(key => [en.common[key], `common.${key}`]),
);

export function translateSharedLabel(value: ReactNode, t: TFunction): ReactNode {
  return Children.map(value, child => {
    if (typeof child !== "string") return child;
    const trimmed = child.trim();
    const key = actionKeysByEnglish.get(trimmed);
    return key ? child.replace(trimmed, String(t(key))) : child;
  });
}

export function translateBasicValidation(message: string, t: TFunction): string {
  if (message === "Required") return String(t("localeFoundation.required"));
  if (message === "Invalid email") return String(t("localeFoundation.invalidEmail"));
  if (Object.prototype.hasOwnProperty.call(consumerEnglish, message)) {
    return String(t(message, { ns: "consumerJourney", keySeparator: false, nsSeparator: false }));
  }
  return message;
}
