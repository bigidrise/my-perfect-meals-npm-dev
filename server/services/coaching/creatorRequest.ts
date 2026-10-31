import { z } from "zod";
import { parseChefCreatorRequest, type ChefCreatorRequest } from "../../../shared/coaching/creatorRequest";

export const CreatorRequestEvidenceSchema = z.object({
  idea: z.string().min(1).max(600),
  memberTurns: z.array(z.number().int().nonnegative()).min(1).max(30),
});

const grammar = new Set(["a", "an", "the", "and", "or", "with", "but", "to", "of", "at", "for", "it", "some", "something"]);
function words(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map(word =>
    word === "flavorful" ? "flavor" : word === "flavourful" ? "flavour" : word);
}

/**
 * Conservative provenance check, not a second semantic model. All food/content
 * words must come from cited member turns, never assistant suggestions or profile
 * data. Unverifiable paraphrases simply keep navigation without a prefill.
 */
export function groundedCreatorRequest(
  value: unknown, destinationId: string | undefined, memberMessages: string[],
): ChefCreatorRequest | undefined {
  if (destinationId !== "create_a_dish") return undefined;
  const parsed = CreatorRequestEvidenceSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const { idea, memberTurns } = parsed.data;
  if (memberTurns.some(index => index >= memberMessages.length)) return undefined;
  const request = parseChefCreatorRequest({ destinationId, idea });
  if (!request) return undefined;
  const source = new Set(memberTurns.flatMap(index => words(memberMessages[index])));
  const content = words(idea).filter(word => !grammar.has(word) && word !== "make" && word !== "based");
  if (!content.length || content.some(word => !source.has(word))) return undefined;
  // Do not silently drop negative constraints, even if the model omitted their
  // turn from its evidence. Conservative failure is preferable to inventing intent.
  for (const message of memberMessages) {
    const constraints: string[] = message.match(/\b(?:no|not|without|avoid)\s+(?!sure\b|certain\b|decided\b)[^,.!?;]+/gi) ?? [];
    if (constraints.some(constraint => !idea.toLocaleLowerCase().includes(constraint.toLocaleLowerCase()))) return undefined;
  }
  return request;
}
