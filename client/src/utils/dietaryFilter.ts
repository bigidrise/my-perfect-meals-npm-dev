export type DietType = "vegan" | "vegetarian" | "pescatarian" | "omnivore";

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
    default:
      return "";
  }
}
