/**
 * A selected Menu card promises concrete foods. Match their names against
 * structured recipe ingredients, never the title or instructions. This only
 * handles grammatical variation, not substitutions or food-safety decisions.
 */
const ABSTRACT_INGREDIENT =
  /^(?:spices?|seasonings?|herbs?|aromatics?|toppings?|condiments?|vegetables?|proteins?|produce|sauce|base|ingredients?|greens?)$/i;

export function hasConcreteSelectedIngredients(names: readonly string[]): boolean {
  return names.every(name => !ABSTRACT_INGREDIENT.test(name.trim()));
}

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/).filter(Boolean).map(word => {
      if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
      if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
      if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
      return word;
    });
}

export function missingSelectedIngredientPositions(
  selected: readonly string[],
  recipeIngredientNames: readonly string[],
): number[] {
  return selected.flatMap((required, index) => {
    // An abstract selected item cannot be proved by a named spice or a phrase
    // in instructions. It must be made concrete before the card is offered.
    if (!hasConcreteSelectedIngredients([required])) return [index];
    const terms = normalizedWords(required);
    if (!terms.length) return [index];
    const present = recipeIngredientNames.some(name => {
      // A product advertised as "onion-free" or merely flavored with onion is
      // not evidence of onions. A named ingredient containing onion is.
      if (/\b(?:free|less|flavou?red|flavou?ring|extract|seasoning)\b/i.test(name) &&
          !/\b(?:free|less|flavou?red|flavou?ring|extract|powder|seasoning)\b/i.test(required)) {
        return false;
      }
      // Plural selected foods (onions, tomatoes) describe the food itself, not
      // a powdered flavoring. Unqualified cocoa can legitimately be cocoa powder.
      if (/\bpowder\b/i.test(name) && /s$/i.test(required.trim())) return false;
      const words = normalizedWords(name);
      return words.some((word, start) =>
        word === terms[0] && terms.every((term, offset) => words[start + offset] === term));
    });
    return present ? [] : [index];
  });
}