/** Display copy only. Never use on identifiers, routes, stored data or entitlements. */
export function chefMemberText(text: string): string {
  return text.replace(/\b(?:Chef|Coach)(?:['’]s|s)? Corner\b/gi, "Ask Chef");
}
