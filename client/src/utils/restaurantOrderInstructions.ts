const DIET_SKIP = new Set(["no-restriction", "no_restriction", "none", "", "omnivore"]);

export function getOrderInstructions(diet: string, mealName: string): string[] {
  const normalizedMeal = mealName.toLowerCase();
  const normalizedDiet = diet.toLowerCase().trim();

  if (!normalizedDiet || DIET_SKIP.has(normalizedDiet)) return [];

  const instructions: string[] = [];

  switch (normalizedDiet) {
    case "pescatarian":
      instructions.push(
        "Ask if the dish contains bacon, pork, or chicken",
        "Request no meat-based broths or stocks",
        "Confirm only fish or seafood protein is used",
        "Avoid meat-based garnishes or toppings",
      );
      if (
        normalizedMeal.includes("chowder") ||
        normalizedMeal.includes("soup") ||
        normalizedMeal.includes("bisque") ||
        normalizedMeal.includes("gravy")
      ) {
        instructions.push("Confirm no bacon or pork fat is used in the base");
      }
      break;

    case "vegan":
      instructions.push(
        "Ask if any dairy (butter, milk, cream, cheese) is used",
        "Confirm no eggs are included",
        "Request plant-based oils instead of butter",
        "Avoid animal-based broths or sauces",
      );
      break;

    case "vegetarian":
      instructions.push(
        "Confirm no meat, poultry, or seafood is in the dish",
        "Ask about meat-based stocks or broths used in cooking",
        "Request vegetable broth if a soup or sauce base is involved",
        "Check for hidden meat in garnishes or toppings",
      );
      break;

    case "keto":
      instructions.push(
        "Ask to remove bread, rice, or pasta from the dish",
        "Request extra vegetables instead of starches",
        "Confirm no added sugars or sweet sauces are used",
        "Prioritize protein and healthy fats in your order",
      );
      break;

    case "paleo":
      instructions.push(
        "Ask to remove grains, dairy, and legumes from the dish",
        "Request simple preparation — grilled, baked, or roasted",
        "Avoid processed sauces or dressings",
        "Confirm no refined oils or additives are used",
      );
      break;

    case "mediterranean":
      instructions.push(
        "Request olive oil instead of butter or heavy fats",
        "Ask for lean proteins — fish, chicken, or legumes",
        "Request light sauces or dressings on the side",
        "Ask for extra vegetables or salad as a side",
      );
      break;

    default:
      break;
  }

  return instructions;
}
