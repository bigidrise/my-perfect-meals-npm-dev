export type PortionMethod =
  | "single-serving"
  | "container-divided"
  | "weight-divided"
  | "slice-based"
  | "spoon-divided"
  | "plate-divided";

const SLICE_TERMS = [
  "bar", "bars", "brownie", "brownies", "tart", "flapjack",
  "fridge cake", "refrigerator cake", "protein cake", "energy bar",
  "no-bake bar", "loaf",
];

const CONTAINER_TERMS = [
  "overnight oat", "chia pudding", "chia jar", "mason jar",
  "meal prep", "parfait", "pudding cup", "yogurt cup",
];

const SPOON_TERMS = [
  "mousse", "fluff", "whip", "whipped", "panna cotta", "custard",
  "soft serve", "pudding mousse",
];

const NO_BAKE_TERMS = [
  "no-bake", "no bake", "nobake", "pudding", "cheesecake",
  "overnight oat", "chia", "carrot cake jar", "yogurt bowl",
  "protein bowl", "dessert bowl", "cream cheese", "chilled",
  "refrigerator", "freezer", "frozen dessert", "tiramisu",
  "peanut butter cup", "protein fluff",
];

const PLATE_TERMS = [
  "skillet", "stir-fry", "stir fry", "pasta", "rice bowl", "chili",
  "soup", "casserole", "stew", "curry", "roast", "sheet pan",
  "sheet-pan", "one-pan", "one pan", "tray bake", "tray baked",
  "meatloaf", "fried rice", "noodle", "ramen", "burrito bowl",
  "grain bowl", "power bowl", "scramble", "hash", "frittata",
];

export function classifyPortionMethod(
  name: string,
  description = "",
  servings = 1
): PortionMethod {
  if (servings <= 1) return "single-serving";

  const haystack = `${name} ${description}`.toLowerCase();

  if (SLICE_TERMS.some((t) => haystack.includes(t))) return "slice-based";
  if (CONTAINER_TERMS.some((t) => haystack.includes(t))) return "container-divided";
  if (SPOON_TERMS.some((t) => haystack.includes(t))) return "spoon-divided";
  if (NO_BAKE_TERMS.some((t) => haystack.includes(t))) return "container-divided";
  if (PLATE_TERMS.some((t) => haystack.includes(t))) return "plate-divided";

  return "plate-divided";
}

export function getPortionLabel(method: PortionMethod, servings: number): string {
  switch (method) {
    case "single-serving":
      return "This recipe is 1 serving — no dividing needed.";
    case "slice-based":
      return `Chill or set, then slice into ${servings} equal pieces.`;
    case "container-divided":
      return `Divide evenly into ${servings} jars or bowls.`;
    case "spoon-divided":
      return `Spoon evenly into ${servings} dessert bowls or cups.`;
    case "weight-divided":
      return `Weigh the finished mixture and divide evenly into ${servings} portions.`;
    case "plate-divided":
      return `Divide evenly across ${servings} plates or meal prep containers.`;
  }
}
