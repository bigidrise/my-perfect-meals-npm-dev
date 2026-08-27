/**
 * Beverage Creator title identity.
 *
 * This is intentionally scoped to generated beverage titles. It must not be
 * reused as a platform-wide meal-title transformation.
 */

type BeverageDietKey =
  | "mediterranean"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "keto"
  | "paleo"
  | "flexitarian"
  | "gluten-free"
  | "kosher"
  | "halal"
  | "carnivore"
  | "low-sugar"
  | "dairy-free"
  | "high-protein"
  | "low-calorie"
  | "no-alcohol";

const ENGLISH_LABELS: Record<BeverageDietKey, string> = {
  mediterranean: "Mediterranean",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  keto: "Keto",
  paleo: "Paleo",
  flexitarian: "Flexitarian",
  "gluten-free": "Gluten-Free",
  kosher: "Kosher",
  halal: "Halal",
  carnivore: "Carnivore",
  "low-sugar": "Low-Sugar",
  "dairy-free": "Dairy-Free",
  "high-protein": "High-Protein",
  "low-calorie": "Low-Calorie",
  "no-alcohol": "No-Alcohol",
};

const DIET_ALIASES: Record<string, BeverageDietKey> = {
  mediterranean: "mediterranean",
  vegan: "vegan",
  vegetarian: "vegetarian",
  pescatarian: "pescatarian",
  keto: "keto",
  paleo: "paleo",
  flexitarian: "flexitarian",
  "gluten-free": "gluten-free",
  "gluten free": "gluten-free",
  kosher: "kosher",
  halal: "halal",
  carnivore: "carnivore",
  "low-sugar": "low-sugar",
  "low sugar": "low-sugar",
  "dairy-free": "dairy-free",
  "dairy free": "dairy-free",
  "high-protein": "high-protein",
  "high protein": "high-protein",
  "low-calorie": "low-calorie",
  "low calorie": "low-calorie",
  "no-alcohol": "no-alcohol",
  "no alcohol": "no-alcohol",
};

/**
 * Labels used when the AI returns a title without the requested identity.
 * The language follows the same base-language convention as the AI prompt.
 * The additional preference labels intentionally fall back to English because
 * they are not part of the localized diet-style identity registry.
 */
const LOCALIZED_LABELS: Record<string, Partial<Record<BeverageDietKey, string>>> = {
  es: {
    mediterranean: "Mediterráneo",
    vegan: "Vegano",
    vegetarian: "Vegetariano",
    pescatarian: "Pescetariano",
    keto: "Keto",
    paleo: "Paleo",
    flexitarian: "Flexitariano",
    "gluten-free": "Sin Gluten",
    kosher: "Kosher",
    halal: "Halal",
    carnivore: "Carnívoro",
  },
  fr: {
    mediterranean: "Méditerranéen",
    vegan: "Végane",
    vegetarian: "Végétarien",
    pescatarian: "Pescétarien",
    keto: "Kéto",
    paleo: "Paléo",
    flexitarian: "Flexitarien",
    "gluten-free": "Sans Gluten",
    kosher: "Casher",
    halal: "Halal",
    carnivore: "Carnivore",
  },
  de: {
    mediterranean: "Mediterran",
    vegan: "Vegan",
    vegetarian: "Vegetarisch",
    pescatarian: "Pescetarisch",
    keto: "Keto",
    paleo: "Paleo",
    flexitarian: "Flexitarisch",
    "gluten-free": "Glutenfrei",
    kosher: "Koscher",
    halal: "Halal",
    carnivore: "Karnivor",
  },
  it: {
    mediterranean: "Mediterraneo",
    vegan: "Vegano",
    vegetarian: "Vegetariano",
    pescatarian: "Pescetariano",
    keto: "Keto",
    paleo: "Paleo",
    flexitarian: "Flessitariano",
    "gluten-free": "Senza Glutine",
    kosher: "Kosher",
    halal: "Halal",
    carnivore: "Carnivoro",
  },
  pt: {
    mediterranean: "Mediterrâneo",
    vegan: "Vegano",
    vegetarian: "Vegetariano",
    pescatarian: "Pescetariano",
    keto: "Keto",
    paleo: "Paleo",
    flexitarian: "Flexitariano",
    "gluten-free": "Sem Glúten",
    kosher: "Kosher",
    halal: "Halal",
    carnivore: "Carnívoro",
  },
  zh: {
    mediterranean: "地中海",
    vegan: "纯素",
    vegetarian: "素食",
    pescatarian: "鱼素",
    keto: "生酮",
    paleo: "古饮食",
    flexitarian: "弹性素食",
    "gluten-free": "无麸质",
    kosher: "犹太洁食",
    halal: "清真",
    carnivore: "纯肉",
  },
  ja: {
    mediterranean: "地中海式",
    vegan: "ヴィーガン",
    vegetarian: "ベジタリアン",
    pescatarian: "ペスカタリアン",
    keto: "ケト",
    paleo: "パレオ",
    flexitarian: "フレキシタリアン",
    "gluten-free": "グルテンフリー",
    kosher: "コーシャ",
    halal: "ハラル",
    carnivore: "肉食",
  },
  ko: {
    mediterranean: "지중해식",
    vegan: "비건",
    vegetarian: "채식",
    pescatarian: "페스코",
    keto: "케토",
    paleo: "팔레오",
    flexitarian: "플렉시테리언",
    "gluten-free": "글루텐 프리",
    kosher: "코셔",
    halal: "할랄",
    carnivore: "육식",
  },
  ar: {
    mediterranean: "متوسطي",
    vegan: "نباتي صرف",
    vegetarian: "نباتي",
    pescatarian: "نباتي مع السمك",
    keto: "كيتو",
    paleo: "باليو",
    flexitarian: "مرن نباتي",
    "gluten-free": "خالٍ من الغلوتين",
    kosher: "كوشير",
    halal: "حلال",
    carnivore: "لحمي",
  },
  hi: {
    mediterranean: "भूमध्यसागरीय",
    vegan: "वीगन",
    vegetarian: "शाकाहारी",
    pescatarian: "पेस्केटेरियन",
    keto: "कीटो",
    paleo: "पेलियो",
    flexitarian: "फ्लेक्सिटेरियन",
    "gluten-free": "ग्लूटेन-मुक्त",
    kosher: "कोशर",
    halal: "हलाल",
    carnivore: "मांसाहारी",
  },
  ru: {
    mediterranean: "Средиземноморский",
    vegan: "Веган",
    vegetarian: "Вегетарианский",
    pescatarian: "Пескетарианский",
    keto: "Кето",
    paleo: "Палео",
    flexitarian: "Флекситарианский",
    "gluten-free": "Без глютена",
    kosher: "Кошерный",
    halal: "Халяль",
    carnivore: "Мясной",
  },
  vi: {
    mediterranean: "Địa Trung Hải",
    vegan: "Thuần chay",
    vegetarian: "Chay",
    pescatarian: "Ăn cá",
    keto: "Keto",
    paleo: "Paleo",
    flexitarian: "Linh hoạt",
    "gluten-free": "Không gluten",
    kosher: "Kosher",
    halal: "Halal",
    carnivore: "Ăn thịt",
  },
  tl: {
    mediterranean: "Mediterranean",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    pescatarian: "Pescatarian",
    keto: "Keto",
    paleo: "Paleo",
    flexitarian: "Flexitarian",
    "gluten-free": "Gluten-Free",
    kosher: "Kosher",
    halal: "Halal",
    carnivore: "Carnivore",
  },
};

function normalizeDietValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

function toValues(restrictions: unknown): string[] {
  if (Array.isArray(restrictions)) {
    return restrictions.flatMap((value) => toValues(value));
  }
  return typeof restrictions === "string" && restrictions.trim()
    ? [restrictions]
    : [];
}

function resolveDietKey(restrictions: unknown): BeverageDietKey | null {
  for (const value of toValues(restrictions)) {
    const key = DIET_ALIASES[normalizeDietValue(value)];
    if (key) return key;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleContainsLabel(title: string, label: string): boolean {
  // Treat hyphens and spaces equivalently so "Gluten-Free" and
  // "Gluten Free" cannot be duplicated.
  const pattern = escapeRegExp(label).replace(/[-\s]+/g, "[\\s-]+");
  return new RegExp(`(^|[^\\p{L}])${pattern}(?=$|[^\\p{L}])`, "iu").test(title);
}

export function getBeverageDietTitleLabel(
  restrictions: unknown,
  language = "en",
): string | null {
  const key = resolveDietKey(restrictions);
  if (!key) return null;

  const baseLanguage = language.split("-")[0].toLowerCase();
  return LOCALIZED_LABELS[baseLanguage]?.[key] ?? ENGLISH_LABELS[key];
}

/**
 * Ensures a generated Beverage Creator title visibly names the selected diet.
 * The original title is preserved when the identity is already present.
 */
export function ensureBeverageDietTitle(
  name: unknown,
  restrictions: unknown,
  language = "en",
): unknown {
  if (typeof name !== "string" || !name.trim()) return name;

  const key = resolveDietKey(restrictions);
  if (!key) return name;

  const localizedLabel = getBeverageDietTitleLabel(restrictions, language);
  const englishLabel = ENGLISH_LABELS[key];
  if (
    (localizedLabel && titleContainsLabel(name, localizedLabel)) ||
    titleContainsLabel(name, englishLabel)
  ) {
    return name;
  }

  return `${localizedLabel ?? englishLabel} ${name.trim()}`;
}