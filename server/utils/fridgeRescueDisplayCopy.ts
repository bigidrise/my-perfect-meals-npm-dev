import { resolveRequestLanguagePreference } from "./languageInstruction";
import { consumerFeatureSpanish } from "../../client/src/i18n/consumerFeatureCopy";

/** Only newly-created, app-owned fallback prose. Ingredient names, IDs,
 * numeric nutrition, canonical difficulty and medical-badge inputs stay intact.
 * Never apply this to an existing/generated/saved recipe as a text translator.
 */
export function fridgeRescueDisplayCopy(preference: string | null | undefined, items: string[]) {
  const spanish = resolveRequestLanguagePreference(preference) === "es";
  const first = items[0], second = items[1] || first, list = items.join(", ");
  return {
    missingName: (index: number) => spanish ? `Comida de Rescate de Nevera ${index}` : `Fridge Rescue Meal ${index}`,
    missingDescription: spanish ? "Una comida creativa con los ingredientes que tienes" : "A creative meal using your available ingredients",
    missingInstructions: spanish ? "Combina los ingredientes y cocina hasta que estén hechos." : "Combine ingredients and cook until done.",
    minutes: (count: number) => `${count} ${spanish ? "minutos" : "minutes"}`,
    quantities: spanish ? ["según sea necesario", "1 porción", "al gusto"] : ["as needed", "1 portion", "to taste"],
    fallbacks: [
      {
        name: spanish ? `Sartén sencilla de ${first}` : `Simple ${first} Skillet`,
        description: spanish ? consumerFeatureSpanish["A quick and easy one-pan meal using your available ingredients"] : "A quick and easy one-pan meal using your available ingredients",
        instructions: spanish ? `1. Calienta una sartén grande a fuego medio. 2. Añade ${list} a la sartén. 3. Cocina hasta que todo esté caliente y bien integrado. 4. Sazona al gusto y sirve.` : `1. Heat a large skillet over medium heat. 2. Add ${list} to the pan. 3. Cook until everything is heated through and well combined. 4. Season to taste and serve.`,
      },
      {
        name: spanish ? `Bol variado de ${second}` : `Mixed ${second} Bowl`,
        description: spanish ? consumerFeatureSpanish["A nutritious bowl combining your fridge ingredients"] : "A nutritious bowl combining your fridge ingredients",
        instructions: spanish ? `1. Prepara cada ingrediente por separado. 2. Combina ${list} en un bol grande. 3. Mezcla bien y sirve inmediatamente.` : `1. Prepare each ingredient separately. 2. Combine ${list} in a large bowl. 3. Mix well and serve immediately.`,
      },
      {
        name: spanish ? `Combinación creativa de ${first}` : `Creative ${first} Combo`,
        description: spanish ? consumerFeatureSpanish["An inventive dish making the most of what you have"] : "An inventive dish making the most of what you have",
        instructions: spanish ? `1. Presenta ${list} de forma creativa. 2. Cocina o combina como prefieras. 3. Ajusta los condimentos y sirve.` : `1. Arrange ${list} creatively. 2. Cook or combine as desired. 3. Adjust seasoning and serve.`,
      },
    ],
  };
}
