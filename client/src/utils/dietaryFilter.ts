export type DietType = "vegan" | "vegetarian" | "pescatarian" | "keto" | "paleo" | "omnivore";

const MEAT_TERMS = [
  "beef","steak","burger","ground beef","brisket","ribs","meatball",
  "chicken","poultry","turkey","duck","goose","quail","guinea fowl",
  "pork","bacon","ham","prosciutto","pancetta","lard","salami","pepperoni","chorizo","sausage",
  "lamb","mutton","veal","venison","bison","elk","rabbit","game meat",
  "hot dog","deli meat","meat broth","chicken broth","beef broth","chicken stock","beef stock",
  "bone broth","chicken base","meat",
];

const FISH_TERMS = [
  "fish","salmon","tuna","tilapia","cod","halibut","sardine","anchov","anchovy",
  "shrimp","prawn","crab","lobster","clam","oyster","scallop","mussel","squid","octopus",
  "crayfish","crawfish","seafood","fish sauce","worcestershire","mahi","swordfish",
  "trout","bass","snapper","grouper","catfish","herring","mackerel","pollock",
];

const DAIRY_TERMS = [
  "milk","cheese","butter","cream","yogurt","whey","casein","lactose","ghee",
  "dairy","half and half","sour cream","ricotta","mozzarella","parmesan","cheddar",
  "brie","camembert","feta","cream cheese","ice cream","custard",
];

const EGG_TERMS = [
  "egg","eggs","egg white","egg yolk","mayonnaise","mayo","hollandaise","meringue","aioli",
];

const HIDDEN_ANIMAL_TERMS = [
  "gelatin","gelatine","rennet","lard","suet","tallow","anchovies","fish sauce",
  "worcestershire","oyster sauce","animal broth","bone broth",
];

/**
 * High-carb terms that clearly indicate a non-keto meal in generated content.
 * Kept conservative to avoid false positives on keto-adapted dishes (e.g. "keto bread").
 * A match means the post-generation intercept fires — user gets to decide.
 */
const KETO_HIGH_CARB_TERMS = [
  // Starchy vegetables
  "sweet potato","sweet potatoes","yam","yams",
  "potato","potatoes","mashed potato","mashed potatoes","french fries",
  // Grains (explicit, not "keto bread" type)
  "white rice","brown rice","fried rice","risotto",
  "regular pasta","spaghetti","fettuccine","penne","macaroni","lasagna","ramen","udon",
  "oatmeal","granola",
  "corn tortilla","flour tortilla",
  // Sugars and syrups
  "maple syrup","honey","agave","corn syrup","brown sugar","cane sugar",
  // High-sugar baked goods
  "pancake","waffle","french toast","donut","doughnut","cupcake",
  // Sugary drinks
  "orange juice","apple juice","grape juice","soda","cola","sports drink",
];

/**
 * Terms that indicate a non-paleo meal.
 * Grains, dairy, legumes, processed sweeteners.
 */
const PALEO_EXCLUDED_TERMS = [
  // All grains
  "wheat","oats","oatmeal","barley","rye","corn","white rice","brown rice","quinoa",
  "bread","pasta","noodles","cereal","crackers","tortilla","pita","granola",
  // All dairy
  "milk","cheese","butter","cream","yogurt","ice cream","whey","casein",
  "mozzarella","parmesan","cheddar","ricotta","feta","sour cream","cream cheese",
  // Legumes
  "beans","black beans","kidney beans","pinto beans","chickpeas","lentils",
  "peanuts","peanut butter","tofu","tempeh","edamame","hummus",
  // Processed/refined sweeteners
  "refined sugar","corn syrup","agave","honey","artificial sweetener",
  "canola oil","vegetable oil","soybean oil","margarine",
];

export function normalizeDiet(rawDiet?: string | string[] | null): DietType {
  const input = Array.isArray(rawDiet)
    ? rawDiet.join(" ").toLowerCase()
    : (rawDiet ?? "").toLowerCase();

  if (input.includes("vegan") || input.includes("plant-based") || input.includes("plant based")) return "vegan";
  if (input.includes("pescatarian") || input.includes("pesco")) return "pescatarian";
  if (
    input.includes("vegetarian") ||
    input.includes("no meat") ||
    input.includes("meatless") ||
    input.includes("no red meat")
  ) return "vegetarian";
  if (input.includes("keto")) return "keto";
  if (input.includes("paleo")) return "paleo";
  return "omnivore";
}

export function mealMatchesDiet(
  diet: DietType,
  meal: { name?: string; description?: string; ingredients?: any[] }
): boolean {
  if (diet === "omnivore") return true;

  // Normalize ingredients to strings, handling both string[] and object[] formats
  const ingredientStrings = (meal.ingredients ?? []).map((ing) => {
    if (typeof ing === "string") return ing;
    // Handle structured ingredient objects: {name, item, quantity, displayText, ...}
    return [ing.name, ing.item, ing.displayText, ing.notes].filter(Boolean).join(" ");
  });

  const content = [
    meal.name ?? "",
    meal.description ?? "",
    ...ingredientStrings,
  ]
    .join(" ")
    .toLowerCase();

  const has = (terms: string[]) => terms.some((t) => content.includes(t));

  switch (diet) {
    case "vegan":
      return !has([...MEAT_TERMS, ...FISH_TERMS, ...DAIRY_TERMS, ...EGG_TERMS, ...HIDDEN_ANIMAL_TERMS]);
    case "vegetarian":
      return !has([...MEAT_TERMS, ...FISH_TERMS, ...HIDDEN_ANIMAL_TERMS]);
    case "pescatarian":
      return !has(MEAT_TERMS);
    case "keto":
      return !has(KETO_HIGH_CARB_TERMS);
    case "paleo":
      return !has(PALEO_EXCLUDED_TERMS);
    default:
      return true;
  }
}

export function filterMealsByDiet<T>(
  diet: DietType,
  meals: T[],
  project: (m: T) => { name?: string; description?: string; ingredients?: string[] }
): T[] {
  if (diet === "omnivore") return meals;
  return meals.filter((m) => mealMatchesDiet(diet, project(m)));
}

export function dietExclusionList(diet: DietType): string {
  switch (diet) {
    case "vegan":
      return "meat, poultry, fish, seafood, dairy, eggs, gelatin, rennet, lard, fish sauce, bone broth, or any animal products";
    case "vegetarian":
      return "meat, poultry, fish, seafood, anchovies, fish sauce, gelatin, rennet, lard, or any animal flesh";
    case "pescatarian":
      return "beef, chicken, pork, lamb, turkey, duck, or any land-based meat";
    case "keto":
      return "potatoes, sweet potatoes, rice, pasta, bread, sugar, honey, maple syrup, corn, or other high-carb ingredients";
    case "paleo":
      return "grains, dairy, legumes, refined sugars, processed oils, or any non-whole-food ingredients";
    default:
      return "";
  }
}
