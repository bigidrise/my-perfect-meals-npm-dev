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

export interface CreateDishCulinaryEntry {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  forms: CulinaryForm[];
  methodIds?: CookingMethodId[];
  additionalMethodIds?: CookingMethodId[];
  flavors: CulinaryFlavor[];
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
    ],
  },
  {
    id: "beef",
    name: "Beef",
    aliases: ["beef", "lean beef"],
    category: "protein",
    forms: [
      ["steak-cut", "Steak Cut"],
      ["ground", "Ground"],
      ["strips", "Strips"],
      ["cubed", "Cubed"],
      ["shredded", "Shredded"],
      ["roast", "Roast"],
    ].map(([id, label]) => ({ id, label })),
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
    ].map(([id, label]) => ({ id, label })),
    flavors: [flavors.barbecue, flavors.garlicHerb, flavors.cajun],
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
];
