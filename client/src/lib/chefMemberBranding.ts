import { isChefConversationEnabled } from "./chefCornerExperience";

/** Display copy only. Never use on identifiers, routes, stored data or entitlements. */
export function chefMemberText(text: string): string {
  return isChefConversationEnabled()
    ? text.replace(/\b(?:Chef|Coach)['’]s Corner\b/g, "Ask Chef")
    : text;
}
