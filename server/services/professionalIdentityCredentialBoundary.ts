import { db } from "../db";
import { readCredentialContext } from "./professionalCredentialReviewRepository";
import { credentialReviewStatus } from "./professionalCredentialReviewService";

export async function getCurrentCredentialReview(userId: string) {
  const context = await readCredentialContext(db, { userId });
  return context ? credentialReviewStatus(context) : null;
}
// A roleChanged approval never binds an old Studio marker to a new license.
// Only a current independent, evidence-bound administrative decision clears it.
export async function identityRequiresIndependentCredentialReview(userId: string): Promise<boolean> {
  const review = await getCurrentCredentialReview(userId);
  return !!review?.required && review.status !== "verified";
}
