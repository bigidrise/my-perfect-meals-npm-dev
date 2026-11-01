/** Owner-approved Ask Chef release; never changes the application's environment. */
export function isAskChefConversationEnabled(environment: string | undefined): boolean {
  return environment === "development" || environment === "production";
}

/** Production is released by default; an explicit false remains a visibility rollback. */
export function isAskChefVisible(isProduction: boolean, override?: string): boolean {
  return override === "true" || (isProduction && override !== "false");
}
