export type MyPerfectMenuRestorationStatus =
  | "loading"
  | "succeeded"
  | "failed";

export function shouldGenerateMissingMyPerfectMenuCategory(
  restorationStatus: MyPerfectMenuRestorationStatus,
  conceptCount: number,
): boolean {
  return restorationStatus === "succeeded" && conceptCount === 0;
}