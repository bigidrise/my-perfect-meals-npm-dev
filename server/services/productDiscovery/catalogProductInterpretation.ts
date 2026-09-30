import type { ProductCandidate, ProductEligibilityDecision } from "../../../shared/productCandidateContract";
import { chatJson } from "../../utils/openaiSafe";
import type { ProductSubjectSnapshot } from "./subjectAuthority";

/**
 * Interpretation uses the exact resolved subject used for eligibility and
 * only runs for eligible products. It is never an eligibility assessment.
 * By-name Scan verdicts and hypothetical alternatives are deliberately omitted.
 */
export async function interpretCatalogProduct(
  actorUserId: string,
  subject: ProductSubjectSnapshot,
  candidate: ProductCandidate,
  decision: ProductEligibilityDecision,
): Promise<string | null> {
  if (actorUserId !== subject.actorUserId || actorUserId !== subject.subjectId ||
      subject.status !== "resolved" || decision.status !== "eligible" ||
      subject.fingerprint !== decision.contextFingerprint ||
      subject.subjectId !== decision.subjectId ||
      decision.productKey !== candidate.identity.key) return null;
  try {
    const profileContext = [
      ...subject.dietaryIdentity.map((value) => `Dietary identity: ${value}`),
      ...subject.allergies.map((value) => `Allergy: ${value}`),
      ...subject.explicitAvoidances.map((value) => `Avoid: ${value}`),
      ...subject.medicalOptimizationNames.map((value) => `Optimization: ${value}`),
      ...subject.preferences.map((value) => `Preference: ${value}`),
    ];
    const facts = candidate.facts.filter((fact) =>
      (fact.kind === "ingredients" || fact.kind === "nutrition") &&
      fact.statement.trim()).slice(0, 12);
    if (!facts.length || !profileContext.length) return null;
    const answer = await chatJson({
      system: `You explain sourced packaged-food facts for MyPerfectMeals.
Return JSON {"explanation": "one or two plain sentences", "factIds": ["cited ID"]}.
Use ONLY supplied facts; do not invent amounts, ingredients, labels, clinical thresholds, other products, or current-package status.
Never say the product is safe, approved, recommended, allergen-free, or compliant.
An absent allergen/traces field does not establish absence or cross-contact safety.
Do not turn daily nutrition targets into an intrinsic packaged-product prohibition.
This is an educational explanation, not an eligibility verdict.`,
      user: JSON.stringify({
        product: candidate.identity.name,
        profileContext,
        facts: facts.map((fact) => ({
          id: fact.id, statement: fact.statement,
          source: fact.provenance.source, observedAt: fact.provenance.observedAt,
        })),
      }),
      model: "gpt-4o",
      temperature: 0.1,
    }) as { explanation?: unknown; factIds?: unknown };
    const explanation = typeof answer.explanation === "string"
      ? answer.explanation.trim() : "";
    const cited = Array.isArray(answer.factIds) ? answer.factIds : [];
    if (!explanation || explanation.length > 350 || cited.length < 1 ||
        cited.some((id) => typeof id !== "string" || !facts.some((f) => f.id === id)) ||
        /\b(safe|approved|recommended|allergen.free|compliant|no cross.contact)\b/i.test(explanation)) {
      return null;
    }
    // A novel numerical assertion cannot be laundered through a valid fact ID.
    const quoted = facts.filter((fact) => cited.includes(fact.id))
      .map((fact) => fact.statement).join(" ");
    const mentionedNumbers: string[] = Array.from(explanation.matchAll(/\d+(?:\.\d+)?/g), (match) => match[0]);
    if (mentionedNumbers.some((value) =>
      !new RegExp(`(^|\\D)${value.replace(".", "\\.")}(\\D|$)`).test(quoted))) return null;
    return explanation;
  } catch {
    return null;
  }
}