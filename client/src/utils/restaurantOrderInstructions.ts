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

    case "vegetarian": {
      // Pattern-matched instructions — specific per dish type, then generic fallback
      if (normalizedMeal.includes("taco") || normalizedMeal.includes("burrito") || normalizedMeal.includes("wrap") || normalizedMeal.includes("quesadilla")) {
        instructions.push(
          "Confirm fillings contain no meat, chicken, or pork",
          "Ask if cooking surfaces are shared with meat items",
          "Request extra beans or grilled vegetables for better protein balance",
          "Cheese and sour cream are fine — no need to remove them",
        );
      } else if (normalizedMeal.includes("pasta") || normalizedMeal.includes("marinara") || normalizedMeal.includes("shells") || normalizedMeal.includes("lasagna") || normalizedMeal.includes("noodle") || normalizedMeal.includes("spaghetti") || normalizedMeal.includes("linguine") || normalizedMeal.includes("fettuccine")) {
        instructions.push(
          "Confirm the sauce is not made with meat or animal-based broth",
          "Ask for sauce on the side to control portions",
          "Cheese is vegetarian-safe — no need to remove it",
          "If protein feels low, consider adding a side of beans or an egg-based starter",
        );
      } else if (normalizedMeal.includes("pizza")) {
        instructions.push(
          "Confirm toppings contain no meat, anchovies, or pepperoni",
          "Cheese and dairy toppings are vegetarian-safe",
          "Ask about the sauce base — confirm no meat-based ingredients",
          "Consider adding extra vegetables or an egg topping for more protein",
        );
      } else if (normalizedMeal.includes("salad")) {
        instructions.push(
          "Ask for dressing on the side",
          "Confirm no meat-based toppings or croutons cooked in meat fat",
          "Cheese and egg toppings are vegetarian-safe and add protein",
          "If protein feels low, ask about adding beans, chickpeas, or a boiled egg",
        );
      } else if (normalizedMeal.includes("bowl") || normalizedMeal.includes("rice") || normalizedMeal.includes("grain")) {
        instructions.push(
          "Confirm the base is built without chicken or beef broth",
          "Ask about shared cooking surfaces if the kitchen handles meat",
          "Dairy toppings like cheese or Greek yogurt are vegetarian-safe",
          "Consider adding extra legumes or a fried egg for more protein",
        );
      } else if (normalizedMeal.includes("soup") || normalizedMeal.includes("stew") || normalizedMeal.includes("chowder") || normalizedMeal.includes("bisque")) {
        instructions.push(
          "Ask if the base broth is vegetable-based — not chicken or beef stock",
          "Confirm no hidden meat pieces or garnishes",
          "Dairy cream in the soup is vegetarian-safe",
          "Request a side of bread or beans if you need more substance",
        );
      } else {
        // Generic vegetarian fallback
        instructions.push(
          "Confirm no meat, poultry, or seafood is in the dish",
          "Ask if any sauces or broths are made with animal-based stock",
          "Dairy and eggs are vegetarian-safe — no need to avoid them",
          "Check for hidden meat in garnishes or toppings",
        );
      }
      break;
    }

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
