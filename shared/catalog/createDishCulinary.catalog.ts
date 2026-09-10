import type { CookingMethodId } from "./techniques.catalog";

export interface CulinaryForm {
  id: string;
  label: string;
}

export interface CulinaryFlavor {
  id: string;
  label: string;
  cuisineId?: string;
  allergenTags?: string[];
}

export interface CulinaryTexture {
  id: string;
  label: string;
  compatibleMethodIds: CookingMethodId[];
}

export interface CreateDishCulinaryEntry {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  forms: CulinaryForm[];
  methodIds?: CookingMethodId[];
  additionalMethodIds?: CookingMethodId[];
  textures?: CulinaryTexture[];
  flavors: CulinaryFlavor[];
}

export type CreateDishEvidenceDimension = "form" | "texture" | "flavor";

/**
 * Governed evidence used by both generation instructions and final verification.
 * Keep these markers bounded to affirmative culinary meaning; they are not a
 * general synonym dictionary.
 */
export const CREATE_DISH_GOVERNED_EVIDENCE: Record<
  CreateDishEvidenceDimension,
  Record<string, readonly string[]>
> = {
  form: {
    cubed: ["cubed {{subject}}", "diced {{subject}}", "{{subject}} cut into cubes", "{{subject}} cut into bite-sized pieces"],
    thigh: ["{{subject}} thigh", "{{subject}} thighs"],
    breast: ["{{subject}} breast", "{{subject}} breasts"],
    ground: ["ground {{subject}}", "minced {{subject}}", "{{subject}} is ground", "{{subject}} is minced", "crumble the {{subject}}"],
    flaked: ["flaked {{subject}}", "flaky {{subject}}", "{{subject}} is flaky", "flake the {{subject}}", "{{subject}} flakes easily", "{{subject}} separates into flakes", "{{subject}} broken into flakes"],
  },
  texture: {
    crunchy: ["crunchy", "crisp", "crispy", "golden and crisp", "golden-brown and crisp", "air fry", "air-fry", "fried until crisp"],
    "crispy-exterior": ["crispy", "crisp", "crunchy", "air fry", "air-fry", "fried until golden", "golden-brown exterior"],
    crispy: ["crispy", "crisp", "crunchy", "fry", "fried"],
    tender: ["tender", "braise", "simmer", "slow cook", "poach"],
    juicy: ["juicy", "rest before slicing", "retain moisture"],
    charred: ["char", "charred", "grill marks"],
    browned: ["brown", "browned", "sear", "seared"],
    roasted: ["roast", "roasted", "bake until golden"],
    delicate: ["delicate", "gently poach", "gently steam"],
    "soft-curds": ["soft curds", "gently scramble"],
    "tender-crisp": ["tender-crisp", "tender crisp", "stir fry", "stir-fry"],
  },
  flavor: {
    "korean-inspired": ["korean-inspired", "korean inspired", "korean-style", "korean {{subject}}", "gochujang", "kimchi"],
    "mexican-inspired": ["mexican-inspired", "mexican inspired", "mexican-style", "mexican {{subject}}", "chili-lime", "chile-lime", "adobo", "chipotle", "salsa verde"],
    "lemon-herb": ["lemon herb", "lemon-herb", "lemon and herb", "lemon and herbs", "lemon with herb", "lemon with herbs"],
  },
};

export function getCreateDishGovernedEvidenceTerms(
  dimension: CreateDishEvidenceDimension,
  id: string,
  label: string,
  subject?: string,
): string[] {
  const governedTerms = CREATE_DISH_GOVERNED_EVIDENCE[dimension][id] ?? [];
  const normalizedSubject = subject?.toLowerCase().trim() ?? "";
  const normalizedId = id.replace(/-/g, " ").toLowerCase();
  const normalizedLabel = label.toLowerCase();
  const formBaseTerms = dimension === "form" && normalizedSubject
    ? (
        normalizedSubject.includes(normalizedId) ||
        normalizedSubject.includes(normalizedLabel)
      )
      ? [normalizedSubject]
      : [
          `${normalizedId} ${normalizedSubject}`,
          `${normalizedSubject} ${normalizedId}`,
          `${normalizedLabel} ${normalizedSubject}`,
          `${normalizedSubject} ${normalizedLabel}`,
          `${normalizedSubject} cut into ${normalizedLabel}`,
        ]
    : [];
  return Array.from(new Set([
    ...(dimension === "form"
      ? formBaseTerms
      : [normalizedId, normalizedLabel]),
    ...governedTerms,
  ]))
    .map(term => subject
      ? term.replaceAll("{{subject}}", subject.toLowerCase())
      : term
    )
    .filter(term => !term.includes("{{subject}}"));
}

export const METHOD_TEXTURES: Partial<
  Record<CookingMethodId, { id: string; label: string }[]>
> = {
  "air-fried": [{ id: "crispy-exterior", label: "Crispy Exterior" }],
  baked: [
    { id: "roasted", label: "Roasted" },
    { id: "tender", label: "Tender" },
  ],
  boiled: [{ id: "tender", label: "Tender" }],
  fried: [{ id: "crispy", label: "Crispy" }],
  grilled: [
    { id: "charred", label: "Charred" },
    { id: "juicy", label: "Juicy" },
  ],
  "pan-seared": [
    { id: "browned", label: "Browned" },
    { id: "crispy-exterior", label: "Crispy Exterior" },
  ],
  poached: [{ id: "delicate", label: "Delicate" }],
  scrambled: [{ id: "soft-curds", label: "Soft Curds" }],
  steamed: [{ id: "tender", label: "Tender" }],
  "stir-fried": [{ id: "tender-crisp", label: "Tender-Crisp" }],
  "well-done": [{ id: "tender", label: "Tender" }],
  medium: [{ id: "juicy", label: "Juicy" }],
  "medium-rare": [{ id: "juicy", label: "Juicy" }],
};

const flavors = {
  garlicHerb: { id: "garlic-herb", label: "Garlic Herb" },
  cajun: { id: "cajun", label: "Cajun", cuisineId: "cajun" },
  mediterranean: {
    id: "mediterranean",
    label: "Mediterranean",
    cuisineId: "mediterranean",
  },
  teriyaki: { id: "teriyaki", label: "Teriyaki", cuisineId: "japanese" },
  korean: {
    id: "korean-inspired",
    label: "Korean-Inspired",
    cuisineId: "korean",
  },
  barbecue: { id: "barbecue", label: "Barbecue" },
  lemonHerb: { id: "lemon-herb", label: "Lemon Herb" },
  lemonPepper: { id: "lemon-pepper", label: "Lemon Pepper" },
  citrusHerb: { id: "citrus-herb", label: "Citrus Herb" },
  tomatoHerb: { id: "tomato-herb", label: "Tomato Herb" },
  mushroomHerb: { id: "mushroom-herb", label: "Mushroom Herb" },
  gingerGarlic: { id: "ginger-garlic", label: "Ginger Garlic" },
  smoky: { id: "smoky", label: "Smoky" },
  thai: { id: "thai-inspired", label: "Thai-Inspired", cuisineId: "thai" },
  chinese: {
    id: "chinese-inspired",
    label: "Chinese-Inspired",
    cuisineId: "chinese",
  },
  curry: { id: "curry-spiced", label: "Curry-Spiced", cuisineId: "indian" },
  garlicButter: { id: "garlic-butter", label: "Garlic Butter" },
  honeySavory: { id: "honey-savory", label: "Honey-Style Sweet-Savory" },
  balsamic: { id: "balsamic", label: "Balsamic Herb" },
  rosemary: { id: "rosemary", label: "Rosemary Herb" },
  miso: { id: "miso-inspired", label: "Miso-Inspired", cuisineId: "japanese" },
  mexican: {
    id: "mexican-inspired",
    label: "Mexican-Inspired",
    cuisineId: "mexican",
  },
  indian: {
    id: "indian-inspired",
    label: "Indian-Inspired",
    cuisineId: "indian",
  },
  orangeSpice: {
    id: "orange-spice",
    label: "Orange Spice",
    cuisineId: "chinese",
  },
  peanutLime: {
    id: "peanut-lime",
    label: "Peanut-Lime",
    allergenTags: ["peanut"],
  },
};

export const CREATE_DISH_CULINARY_ENTRIES: CreateDishCulinaryEntry[] = [
  {
    id: "chicken",
    name: "Chicken",
    aliases: ["chicken"],
    category: "poultry",
    forms: [
      ["breast", "Breast"],
      ["thigh", "Thigh"],
      ["ground", "Ground"],
      ["cubed", "Cubed"],
      ["shredded", "Shredded"],
      ["strips", "Strips"],
    ].map(([id, label]) => ({ id, label })),
    additionalMethodIds: ["stir-fried"],
    flavors: [
      flavors.garlicHerb,
      flavors.cajun,
      flavors.mediterranean,
      flavors.teriyaki,
      flavors.korean,
      flavors.barbecue,
      flavors.lemonPepper,
      flavors.gingerGarlic,
      flavors.honeySavory,
    ],
  },
  {
    id: "beef",
    name: "Beef",
    aliases: ["beef", "lean beef", "steak"],
    category: "protein",
    forms: [
      ["steak-cut", "Steak Cut"],
      ["ground", "Ground"],
      ["strips", "Strips"],
      ["cubed", "Cubed"],
      ["shredded", "Shredded"],
      ["roast", "Roast"],
    ].map(([id, label]) => ({ id, label })),
    textures: [
      { id: "fall-apart-tender", label: "Fall-Apart Tender", compatibleMethodIds: ["baked", "boiled"] },
      { id: "caramelized", label: "Caramelized", compatibleMethodIds: ["grilled", "pan-seared"] },
    ],
    flavors: [
      flavors.garlicHerb,
      flavors.mexican,
      flavors.korean,
      flavors.mediterranean,
      flavors.barbecue,
    ],
  },
  {
    id: "salmon",
    name: "Salmon",
    aliases: ["salmon"],
    category: "seafood",
    forms: [
      ["fillet", "Fillet"],
      ["chunks", "Chunks"],
      ["cubed", "Cubed"],
      ["flaked", "Flaked"],
      ["patties", "Patties or Cakes"],
    ].map(([id, label]) => ({ id, label })),
    textures: [
      { id: "flaky", label: "Flaky", compatibleMethodIds: ["baked", "grilled", "pan-seared", "poached", "steamed"] },
      { id: "golden-browned", label: "Golden-Browned", compatibleMethodIds: ["baked", "pan-seared"] },
    ],
    flavors: [
      flavors.lemonHerb,
      flavors.teriyaki,
      flavors.mediterranean,
      flavors.cajun,
      flavors.miso,
    ],
  },
  {
    id: "duck",
    name: "Duck",
    aliases: ["duck"],
    category: "poultry",
    forms: [
      ["breast", "Breast"],
      ["leg", "Leg"],
      ["whole-pieces", "Whole Pieces"],
      ["shredded", "Shredded"],
      ["ground", "Ground"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["pan-seared", "baked", "grilled"],
    flavors: [
      flavors.orangeSpice,
      { id: "five-spice", label: "Five-Spice", cuisineId: "chinese" },
      { id: "cherry-balsamic", label: "Cherry Balsamic" },
      flavors.garlicHerb,
    ],
  },
  {
    id: "tofu",
    name: "Tofu",
    aliases: ["tofu"],
    category: "protein",
    forms: [
      ["cubes", "Cubes"],
      ["slabs", "Slabs"],
      ["crumbled", "Crumbled"],
      ["strips", "Strips"],
      ["silken", "Silken"],
      ["pressed-pieces", "Pressed Pieces"],
    ].map(([id, label]) => ({ id, label })),
    textures: [
      { id: "crunchy", label: "Crunchy", compatibleMethodIds: ["air-fried", "fried", "pan-seared"] },
      { id: "creamy", label: "Creamy", compatibleMethodIds: ["stir-fried", "steamed"] },
      { id: "silky", label: "Silky", compatibleMethodIds: ["steamed", "boiled"] },
    ],
    flavors: [
      flavors.teriyaki,
      flavors.korean,
      { id: "thai-basil", label: "Thai Basil", cuisineId: "thai" },
      flavors.mediterranean,
      flavors.cajun,
      flavors.peanutLime,
    ],
  },
  {
    id: "pork",
    name: "Pork",
    aliases: ["pork"],
    category: "protein",
    forms: [
      ["tenderloin", "Tenderloin"],
      ["chops", "Chops"],
      ["ground", "Ground"],
      ["cubed", "Cubed"],
      ["shredded", "Shredded"],
      ["shoulder", "Shoulder"],
      ["loin", "Loin"],
    ].map(([id, label]) => ({ id, label })),
    additionalMethodIds: ["baked", "grilled", "pan-seared", "stir-fried"],
    flavors: [
      flavors.barbecue,
      flavors.garlicHerb,
      flavors.cajun,
      flavors.mediterranean,
      flavors.honeySavory,
      flavors.gingerGarlic,
    ],
  },
  {
    id: "eggs",
    name: "Eggs",
    aliases: ["egg", "eggs"],
    category: "egg",
    forms: [
      ["whole", "Whole"],
      ["whisked", "Whisked"],
      ["separated", "Separated"],
    ].map(([id, label]) => ({ id, label })),
    flavors: [flavors.garlicHerb, flavors.mexican, flavors.mediterranean],
  },
  {
    id: "broccoli",
    name: "Broccoli",
    aliases: ["broccoli"],
    category: "fibrous-carb",
    forms: [
      ["florets", "Florets"],
      ["chopped", "Chopped"],
      ["stems", "Stems"],
    ].map(([id, label]) => ({ id, label })),
    flavors: [flavors.garlicHerb, flavors.teriyaki, flavors.cajun],
  },
  {
    id: "octopus",
    name: "Octopus",
    aliases: ["octopus"],
    category: "seafood",
    forms: [
      ["tentacles", "Tentacles"],
      ["whole-small", "Whole Small Octopus"],
      ["sliced", "Sliced"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["grilled", "boiled", "pan-seared"],
    flavors: [flavors.mediterranean, flavors.garlicHerb, flavors.lemonHerb],
  },
  {
    id: "turkey",
    name: "Turkey",
    aliases: ["turkey", "ground turkey", "turkey breast", "turkey thigh"],
    category: "poultry",
    forms: [
      ["breast", "Breast"],
      ["thigh", "Thigh"],
      ["ground", "Ground"],
      ["cubed", "Cubed"],
      ["strips", "Strips"],
      ["shredded", "Shredded"],
    ].map(([id, label]) => ({ id, label })),
    additionalMethodIds: ["baked", "grilled", "pan-seared", "stir-fried"],
    flavors: [
      flavors.garlicHerb,
      flavors.mediterranean,
      flavors.mexican,
      flavors.barbecue,
      flavors.lemonPepper,
      flavors.cajun,
    ],
  },
  {
    id: "ground-beef",
    name: "Ground Beef",
    aliases: ["ground beef", "hamburger", "minced beef"],
    category: "protein",
    forms: [
      ["ground", "Ground"],
      ["patties", "Patties"],
      ["crumbled", "Crumbled"],
      ["meatballs", "Meatballs"],
    ].map(([id, label]) => ({ id, label })),
    additionalMethodIds: ["baked", "grilled", "pan-seared", "stir-fried"],
    flavors: [
      flavors.garlicHerb,
      flavors.mexican,
      flavors.korean,
      flavors.barbecue,
      flavors.cajun,
      flavors.gingerGarlic,
    ],
  },
  {
    id: "pork-tenderloin",
    name: "Pork Tenderloin",
    aliases: ["pork tenderloin", "pork fillet"],
    category: "protein",
    forms: [
      ["whole", "Whole"],
      ["medallions", "Medallions"],
      ["sliced", "Sliced"],
      ["cubed", "Cubed"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "pan-seared"],
    flavors: [
      flavors.garlicHerb,
      flavors.mediterranean,
      flavors.barbecue,
      flavors.honeySavory,
      flavors.citrusHerb,
    ],
  },
  {
    id: "cod",
    name: "Cod",
    aliases: ["cod", "cod fillet", "codfish"],
    category: "seafood",
    forms: [
      ["fillet", "Fillet"],
      ["chunks", "Chunks"],
      ["cubed", "Cubed"],
      ["flaked", "Flaked"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "pan-seared", "poached", "steamed"],
    flavors: [
      flavors.lemonPepper,
      flavors.lemonHerb,
      flavors.garlicHerb,
      flavors.mediterranean,
      flavors.cajun,
      flavors.tomatoHerb,
    ],
  },
  {
    id: "tilapia",
    name: "Tilapia",
    aliases: ["tilapia"],
    category: "seafood",
    forms: [
      ["fillet", "Fillet"],
      ["chunks", "Chunks"],
      ["cubed", "Cubed"],
      ["flaked", "Flaked"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "pan-seared", "poached"],
    flavors: [
      flavors.lemonPepper,
      flavors.cajun,
      flavors.garlicHerb,
      flavors.mexican,
      flavors.mediterranean,
    ],
  },
  {
    id: "tuna",
    name: "Tuna",
    aliases: ["tuna", "tuna steak", "canned tuna"],
    category: "seafood",
    forms: [
      ["steak", "Steak"],
      ["chunks", "Chunks"],
      ["flaked", "Flaked"],
      ["patties", "Patties or Cakes"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["pan-seared", "grilled", "baked"],
    flavors: [
      flavors.lemonPepper,
      flavors.teriyaki,
      flavors.mediterranean,
      flavors.gingerGarlic,
      flavors.cajun,
    ],
  },
  {
    id: "shrimp",
    name: "Shrimp",
    aliases: ["shrimp", "prawns", "prawn"],
    category: "seafood",
    forms: [
      ["whole-peeled", "Whole, Peeled"],
      ["chopped", "Chopped"],
      ["skewered", "Skewered"],
      ["butterflied", "Butterflied"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["grilled", "pan-seared", "steamed", "stir-fried"],
    flavors: [
      flavors.garlicButter,
      flavors.garlicHerb,
      flavors.cajun,
      flavors.teriyaki,
      flavors.thai,
      flavors.lemonHerb,
    ],
  },
  {
    id: "scallops",
    name: "Scallops",
    aliases: ["scallop", "scallops"],
    category: "seafood",
    forms: [
      ["whole", "Whole"],
      ["medallions", "Medallions"],
      ["skewered", "Skewered"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["pan-seared", "grilled", "baked"],
    flavors: [flavors.garlicButter, flavors.lemonHerb, flavors.citrusHerb],
  },
  {
    id: "crab",
    name: "Crab",
    aliases: ["crab", "crab meat"],
    category: "seafood",
    forms: [
      ["whole", "Whole"],
      ["picked-meat", "Picked Meat"],
      ["cakes", "Cakes"],
      ["flaked", "Flaked"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["steamed", "boiled", "baked", "pan-seared"],
    flavors: [flavors.garlicButter, flavors.lemonHerb, flavors.cajun],
  },
  {
    id: "white-fish",
    name: "White Fish",
    aliases: ["white fish", "whitefish"],
    category: "seafood",
    forms: [
      ["fillet", "Fillet"],
      ["chunks", "Chunks"],
      ["cubed", "Cubed"],
      ["flaked", "Flaked"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "pan-seared", "poached", "steamed"],
    flavors: [flavors.lemonPepper, flavors.garlicHerb, flavors.cajun, flavors.mediterranean],
  },
  {
    id: "red-snapper",
    name: "Red Snapper",
    aliases: ["red snapper", "red snapper fillet"],
    category: "seafood",
    forms: [
      ["fillet", "Fillet"],
      ["whole", "Whole"],
      ["chunks", "Chunks"],
      ["flaked", "Flaked"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "pan-seared", "steamed"],
    flavors: [flavors.lemonPepper, flavors.garlicHerb, flavors.cajun, flavors.mediterranean],
  },
  {
    id: "whiting",
    name: "Whiting",
    aliases: ["whiting", "whiting fillet"],
    category: "seafood",
    forms: [
      ["fillet", "Fillet"],
      ["whole", "Whole"],
      ["chunks", "Chunks"],
      ["flaked", "Flaked"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "pan-seared", "steamed"],
    flavors: [flavors.lemonPepper, flavors.garlicHerb, flavors.cajun, flavors.mediterranean],
  },
  {
    id: "swordfish",
    name: "Swordfish",
    aliases: ["swordfish", "swordfish steak"],
    category: "seafood",
    forms: [
      ["steak", "Steak"],
      ["chunks", "Chunks"],
      ["cubed", "Cubed"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "pan-seared"],
    flavors: [flavors.lemonPepper, flavors.garlicHerb, flavors.cajun, flavors.mediterranean],
  },
  {
    id: "tempeh",
    name: "Tempeh",
    aliases: ["tempeh"],
    category: "protein",
    forms: [
      ["slices", "Slices"],
      ["strips", "Strips"],
      ["cubes", "Cubes"],
      ["crumbled", "Crumbled"],
    ].map(([id, label]) => ({ id, label })),
    additionalMethodIds: ["baked", "pan-seared", "stir-fried", "grilled"],
    flavors: [flavors.teriyaki, flavors.korean, flavors.mexican, flavors.gingerGarlic, flavors.curry],
  },
  {
    id: "chickpeas",
    name: "Chickpeas",
    aliases: ["chickpea", "chickpeas", "garbanzo beans", "garbanzo"],
    category: "legume",
    forms: [
      ["whole", "Whole"],
      ["mashed", "Mashed"],
      ["crispy-roasted", "Crispy-Roasted"],
      ["patties", "Patties or Fritters"],
    ].map(([id, label]) => ({ id, label })),
    textures: [
      { id: "crunchy", label: "Crunchy", compatibleMethodIds: ["baked", "fried"] },
      { id: "creamy", label: "Creamy", compatibleMethodIds: ["boiled"] },
      { id: "golden-browned", label: "Golden-Browned", compatibleMethodIds: ["baked", "fried"] },
    ],
    methodIds: ["baked", "boiled", "fried", "stir-fried"],
    flavors: [flavors.mediterranean, flavors.curry, flavors.mexican, flavors.garlicHerb, flavors.smoky],
  },
  {
    id: "lentils",
    name: "Lentils",
    aliases: ["lentil", "lentils"],
    category: "legume",
    forms: [
      ["whole", "Whole"],
      ["cooked", "Cooked"],
      ["mashed", "Mashed"],
      ["patties", "Patties"],
    ].map(([id, label]) => ({ id, label })),
    methodIds: ["boiled", "baked", "stir-fried"],
    flavors: [flavors.curry, flavors.mediterranean, flavors.mexican, flavors.tomatoHerb, flavors.garlicHerb],
  },
  {
    id: "black-beans",
    name: "Black Beans",
    aliases: ["black bean", "black beans"],
    category: "legume",
    forms: [["whole", "Whole"], ["mashed", "Mashed"], ["refried", "Refried"]].map(([id, label]) => ({ id, label })),
    methodIds: ["boiled", "baked", "stir-fried"],
    flavors: [flavors.mexican, flavors.cajun, flavors.smoky, flavors.garlicHerb],
  },
  {
    id: "kidney-beans",
    name: "Kidney Beans",
    aliases: ["kidney bean", "kidney beans"],
    category: "legume",
    forms: [["whole", "Whole"], ["mashed", "Mashed"]].map(([id, label]) => ({ id, label })),
    methodIds: ["boiled", "baked", "stir-fried"],
    flavors: [flavors.mexican, flavors.curry, flavors.smoky, flavors.tomatoHerb],
  },
  {
    id: "white-beans",
    name: "White Beans",
    aliases: ["white bean", "white beans", "navy beans", "cannellini beans"],
    category: "legume",
    forms: [["whole", "Whole"], ["mashed", "Mashed"], ["pureed", "Purée"]].map(([id, label]) => ({ id, label })),
    methodIds: ["boiled", "baked", "stir-fried"],
    flavors: [flavors.garlicHerb, flavors.mediterranean, flavors.tomatoHerb, flavors.curry],
  },
  {
    id: "egg-whites",
    name: "Egg Whites",
    aliases: ["egg white", "egg whites", "whites"],
    category: "egg",
    forms: [["separated", "Separated"], ["whisked", "Whisked"], ["whole", "Whole"]].map(([id, label]) => ({ id, label })),
    methodIds: ["scrambled", "baked", "poached", "fried"],
    flavors: [flavors.garlicHerb, flavors.mexican, flavors.mediterranean, flavors.cajun],
  },
  {
    id: "cauliflower",
    name: "Cauliflower",
    aliases: ["cauliflower"],
    category: "fibrous-carb",
    forms: [["florets", "Florets"], ["chopped", "Chopped"], ["riced", "Riced"], ["steak", "Steaks"]].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "steamed", "boiled", "stir-fried"],
    flavors: [flavors.garlicHerb, flavors.curry, flavors.cajun, flavors.mediterranean],
  },
  {
    id: "zucchini",
    name: "Zucchini",
    aliases: ["zucchini", "courgette"],
    category: "fibrous-carb",
    forms: [["sliced", "Sliced"], ["halves", "Halves"], ["spiralized", "Spiralized"], ["cubed", "Cubed"]].map(([id, label]) => ({ id, label })),
    methodIds: ["grilled", "baked", "steamed", "stir-fried"],
    flavors: [flavors.garlicHerb, flavors.mediterranean, flavors.lemonHerb, flavors.cajun],
  },
  {
    id: "bell-pepper",
    name: "Bell Pepper",
    aliases: ["bell pepper", "bell peppers", "sweet pepper"],
    category: "fibrous-carb",
    forms: [["sliced", "Sliced"], ["strips", "Strips"], ["diced", "Diced"], ["halves", "Halves"]].map(([id, label]) => ({ id, label })),
    methodIds: ["grilled", "baked", "stir-fried"],
    flavors: [flavors.mexican, flavors.mediterranean, flavors.garlicHerb, flavors.cajun],
  },
  {
    id: "mushrooms",
    name: "Mushrooms",
    aliases: ["mushroom", "mushrooms"],
    category: "fibrous-carb",
    forms: [["whole", "Whole"], ["sliced", "Sliced"], ["chopped", "Chopped"], ["quartered", "Quartered"]].map(([id, label]) => ({ id, label })),
    methodIds: ["pan-seared", "baked", "grilled", "stir-fried"],
    flavors: [flavors.mushroomHerb, flavors.garlicHerb, flavors.teriyaki, flavors.mediterranean],
  },
  {
    id: "eggplant",
    name: "Eggplant",
    aliases: ["eggplant", "aubergine"],
    category: "fibrous-carb",
    forms: [["sliced", "Sliced"], ["cubed", "Cubed"], ["halves", "Halves"], ["diced", "Diced"]].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "stir-fried"],
    flavors: [flavors.mediterranean, flavors.curry, flavors.miso, flavors.garlicHerb],
  },
  {
    id: "asparagus",
    name: "Asparagus",
    aliases: ["asparagus"],
    category: "fibrous-carb",
    forms: [["spears", "Spears"], ["chopped", "Chopped"], ["whole", "Whole"]].map(([id, label]) => ({ id, label })),
    methodIds: ["grilled", "baked", "steamed", "pan-seared"],
    flavors: [flavors.garlicHerb, flavors.lemonHerb, flavors.mediterranean, flavors.lemonPepper],
  },
  {
    id: "green-beans",
    name: "Green Beans",
    aliases: ["green bean", "green beans", "string beans"],
    category: "fibrous-carb",
    forms: [["whole", "Whole"], ["trimmed", "Trimmed"], ["cut", "Cut"]].map(([id, label]) => ({ id, label })),
    methodIds: ["steamed", "baked", "boiled", "stir-fried"],
    flavors: [flavors.garlicHerb, flavors.mediterranean, flavors.gingerGarlic, flavors.lemonPepper],
  },
  {
    id: "brussels-sprouts",
    name: "Brussels Sprouts",
    aliases: ["brussels sprout", "brussels sprouts"],
    category: "fibrous-carb",
    forms: [["whole", "Whole"], ["halved", "Halved"], ["shredded", "Shredded"]].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "grilled", "steamed", "pan-seared"],
    flavors: [flavors.garlicHerb, flavors.smoky, flavors.balsamic, flavors.lemonPepper],
  },
  {
    id: "cabbage",
    name: "Cabbage",
    aliases: ["cabbage"],
    category: "fibrous-carb",
    forms: [["shredded", "Shredded"], ["wedges", "Wedges"], ["chopped", "Chopped"], ["leaves", "Leaves"]].map(([id, label]) => ({ id, label })),
    methodIds: ["steamed", "baked", "boiled", "stir-fried"],
    flavors: [flavors.gingerGarlic, flavors.mediterranean, flavors.cajun, flavors.garlicHerb],
  },
  {
    id: "sweet-potato",
    name: "Sweet Potato",
    aliases: ["sweet potato", "sweet potatoes"],
    category: "starchy-carb",
    forms: [["whole", "Whole"], ["cubed", "Cubed"], ["wedges", "Wedges"], ["mashed", "Mashed"], ["fries", "Fries"]].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "boiled", "fried", "air-fried"],
    flavors: [flavors.smoky, flavors.cajun, flavors.curry, flavors.garlicHerb],
  },
  {
    id: "potato",
    name: "Potato",
    aliases: ["potato", "potatoes"],
    category: "starchy-carb",
    forms: [["whole", "Whole"], ["cubed", "Cubed"], ["wedges", "Wedges"], ["mashed", "Mashed"], ["shredded", "Shredded"], ["fries", "Fries"]].map(([id, label]) => ({ id, label })),
    methodIds: ["baked", "boiled", "fried", "air-fried"],
    flavors: [flavors.garlicHerb, flavors.rosemary, flavors.cajun, flavors.smoky],
  },
];
