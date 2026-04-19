/**
 * Restaurant Cuisine Archetype Engine
 *
 * Classifies a restaurant into a cuisine archetype using a 4-level priority stack:
 *   1. Known fast food / chain name match
 *   2. Google Places types array
 *   3. Restaurant name keywords
 *   4. User search query keywords
 *   Fallback: "american_casual"
 *
 * Each archetype carries:
 *   - mustIncludeTerms: at least one MUST appear in AI-generated meal names
 *   - anchorItems: recognizable real-world menu items the AI anchors output to
 *   - realistExample: example of a good meal output for prompt context
 */

export interface CuisineArchetype {
  id: string;
  label: string;
  mustIncludeTerms: string[];
  anchorItems: string[];
  realistExample: string;
  menuRealism: string;
}

export interface ArchetypeResult {
  archetype: CuisineArchetype;
  chainName?: string;
  chainPatterns?: string[];
  confidence: "chain" | "types" | "name" | "query" | "fallback";
}

// ── Fast Food Chain Registry ──────────────────────────────────────────────────
// 10 major chains — name keywords → anchor items + archetype id
const FAST_FOOD_CHAINS: Array<{
  namePatterns: string[];
  archetype: string;
  chainLabel: string;
  anchorItems: string[];
}> = [
  {
    namePatterns: ["mcdonald", "mcdonalds", "mcd", "mickey d"],
    archetype: "fast_food_burger",
    chainLabel: "McDonald's",
    anchorItems: ["McDouble", "Quarter Pounder", "McChicken", "Egg McMuffin", "Filet-O-Fish", "Big Mac"],
  },
  {
    namePatterns: ["chipotle"],
    archetype: "fast_casual_mexican",
    chainLabel: "Chipotle",
    anchorItems: ["Burrito Bowl", "Chicken Burrito", "Steak Tacos", "Sofritas Bowl", "Carnitas Bowl", "Chicken Salad Bowl"],
  },
  {
    namePatterns: ["taco bell"],
    archetype: "fast_food_mexican",
    chainLabel: "Taco Bell",
    anchorItems: ["Crunchy Taco", "Power Menu Bowl", "Chicken Quesadilla", "Beefy 5-Layer Burrito", "Bean Burrito"],
  },
  {
    namePatterns: ["subway"],
    archetype: "sandwich",
    chainLabel: "Subway",
    anchorItems: ["6-inch Turkey Breast", "Veggie Delight", "Chicken & Bacon Ranch", "Tuna Sub", "Black Forest Ham"],
  },
  {
    namePatterns: ["chick-fil-a", "chickfila", "chick fil a"],
    archetype: "fast_food_chicken",
    chainLabel: "Chick-fil-A",
    anchorItems: ["Grilled Chicken Sandwich", "Grilled Nuggets", "Spicy Deluxe Sandwich", "Grilled Chicken Cool Wrap", "Grilled Market Salad"],
  },
  {
    namePatterns: ["panera", "panera bread"],
    archetype: "fast_casual_american",
    chainLabel: "Panera Bread",
    anchorItems: ["You Pick Two", "Frontega Chicken Sandwich", "Greek Salad", "Ten Vegetable Soup", "Turkey Avocado BLT"],
  },
  {
    namePatterns: ["five guys"],
    archetype: "burger",
    chainLabel: "Five Guys",
    anchorItems: ["Little Burger", "Grilled Cheese Sandwich", "Veggie Sandwich", "Hot Dog", "Little Cheeseburger"],
  },
  {
    namePatterns: ["panda express"],
    archetype: "chinese_american",
    chainLabel: "Panda Express",
    anchorItems: ["String Bean Chicken Breast", "Grilled Teriyaki Chicken", "Kung Pao Chicken", "Mushroom Chicken", "Super Greens"],
  },
  {
    namePatterns: ["olive garden"],
    archetype: "italian",
    chainLabel: "Olive Garden",
    anchorItems: ["Herb-Grilled Salmon", "Chicken Margherita", "Shrimp Scampi", "Minestrone Soup", "Chicken & Shrimp Carbonara"],
  },
  {
    namePatterns: ["starbucks"],
    archetype: "cafe",
    chainLabel: "Starbucks",
    anchorItems: ["Protein Box", "Chicken & Quinoa Protein Bowl", "Sous Vide Egg Bites", "Spinach Feta Wrap", "Turkey Provolone Panini"],
  },
];

// ── Archetype Definitions ─────────────────────────────────────────────────────
const ARCHETYPES: Record<string, CuisineArchetype> = {
  fast_food_burger: {
    id: "fast_food_burger",
    label: "Fast Food Burger",
    mustIncludeTerms: ["burger", "sandwich", "nuggets", "wrap"],
    anchorItems: ["Double Cheeseburger", "Grilled Chicken Sandwich", "Chicken Nuggets", "McDouble", "Crispy Chicken Wrap"],
    realistExample: "Grilled Chicken Sandwich, no mayo, add lettuce and tomato",
    menuRealism: "Meals MUST be named like fast food items: burger, sandwich, nuggets, or combo-style. NEVER use terms like 'protein bowl' or 'wellness plate' — that is not this restaurant's menu language.",
  },
  fast_casual_mexican: {
    id: "fast_casual_mexican",
    label: "Fast Casual Mexican",
    mustIncludeTerms: ["bowl", "burrito", "taco", "salad bowl"],
    anchorItems: ["Chicken Burrito Bowl", "Steak Burrito", "Sofritas Tacos", "Barbacoa Bowl", "Veggie Salad Bowl"],
    realistExample: "Chicken Burrito Bowl, brown rice, black beans, fajita veggies, salsa, no sour cream",
    menuRealism: "Meals MUST be framed as bowls, burritos, or tacos — the three real formats at this restaurant. NEVER invent generic salad names — say 'Salad Bowl' with toppings.",
  },
  fast_food_mexican: {
    id: "fast_food_mexican",
    label: "Fast Food Mexican",
    mustIncludeTerms: ["taco", "burrito", "quesadilla", "bowl"],
    anchorItems: ["Power Menu Bowl", "Crunchy Taco", "Bean Burrito", "Chicken Quesadilla", "Soft Taco"],
    realistExample: "Power Menu Bowl with grilled chicken, black beans, guacamole, no cheese",
    menuRealism: "Meals MUST sound like fast-food Mexican chain items: tacos, burritos, or Power Bowl-style. Use the chain's actual product naming style.",
  },
  fast_food_chicken: {
    id: "fast_food_chicken",
    label: "Fast Food Chicken",
    mustIncludeTerms: ["sandwich", "nuggets", "wrap", "grilled chicken"],
    anchorItems: ["Grilled Chicken Sandwich", "Grilled Nuggets", "Cool Wrap", "Spicy Chicken Sandwich", "Grilled Market Salad"],
    realistExample: "Grilled Chicken Sandwich, no sauce, add extra pickles",
    menuRealism: "Meals MUST center around grilled chicken formats: sandwich, nuggets, wrap, or salad. Fried options can appear but grilled should be prioritized for health focus.",
  },
  fast_casual_american: {
    id: "fast_casual_american",
    label: "Fast Casual American",
    mustIncludeTerms: ["sandwich", "soup", "salad", "bowl", "flatbread"],
    anchorItems: ["You Pick Two", "Greek Salad", "Turkey Avocado BLT", "Lemon Chicken Orzo Soup", "Chicken Cobb Salad"],
    realistExample: "You Pick Two: Greek Salad + Ten Vegetable Soup, dressing on the side",
    menuRealism: "Meals MUST sound like bakery-cafe items: sandwiches, soups, salads, or combo plates. Use approachable, bistro-style naming conventions.",
  },
  burger: {
    id: "burger",
    label: "Burger",
    mustIncludeTerms: ["burger", "sandwich", "dog", "patty"],
    anchorItems: ["Classic Burger", "Grilled Chicken Sandwich", "Mushroom Swiss Burger", "Turkey Burger", "Veggie Burger"],
    realistExample: "Grilled Chicken Sandwich, lettuce wrap instead of bun, add grilled onions",
    menuRealism: "Meals MUST include at least one item named 'burger' or 'sandwich.' Do not generate grain bowls or wellness plates — this is a burger restaurant.",
  },
  mexican: {
    id: "mexican",
    label: "Mexican",
    mustIncludeTerms: ["taco", "burrito", "bowl", "enchilada", "fajita", "quesadilla"],
    anchorItems: ["Street Tacos", "Carne Asada Burrito", "Chicken Fajitas", "Enchiladas Verdes", "Burrito Bowl", "Shrimp Tacos"],
    realistExample: "Grilled Chicken Street Tacos, corn tortillas, pico de gallo, no sour cream",
    menuRealism: "At least one meal MUST be named with 'taco,' 'burrito,' or 'bowl.' Fajitas and enchiladas are also acceptable. NEVER return a generic 'Mexican Plate.'",
  },
  italian: {
    id: "italian",
    label: "Italian",
    mustIncludeTerms: ["pasta", "pizza", "risotto", "bruschetta", "piccata", "marsala", "parmesan"],
    anchorItems: ["Grilled Salmon", "Chicken Piccata", "Shrimp Linguine", "Margherita Pizza", "Mushroom Risotto", "Chicken Marsala"],
    realistExample: "Chicken Piccata, capers, lemon butter sauce, side of steamed vegetables",
    menuRealism: "Meals must use authentic Italian naming: piccata, marsala, parmesan, primavera, arrabiata. NEVER say 'Italian-style protein' — use real dish names.",
  },
  chinese_american: {
    id: "chinese_american",
    label: "Chinese-American",
    mustIncludeTerms: ["chicken", "beef", "shrimp", "tofu", "noodles", "fried rice"],
    anchorItems: ["String Bean Chicken", "Kung Pao Shrimp", "Beef with Broccoli", "Steamed Dumplings", "Wonton Soup", "Shrimp Fried Rice"],
    realistExample: "String Bean Chicken Breast, steamed brown rice, no added oil",
    menuRealism: "Meals must sound like Chinese-American restaurant items: named by protein + vegetable or sauce. Use familiar terms like 'with broccoli,' 'kung pao,' 'teriyaki,' 'fried rice.'",
  },
  japanese: {
    id: "japanese",
    label: "Japanese / Sushi",
    mustIncludeTerms: ["sushi", "roll", "sashimi", "ramen", "bowl", "teriyaki", "edamame"],
    anchorItems: ["Salmon Sashimi", "Dragon Roll", "Chicken Teriyaki Bowl", "Miso Ramen", "Tuna Avocado Roll", "Edamame"],
    realistExample: "Salmon Sashimi (8 pieces), seaweed salad, miso soup",
    menuRealism: "Meals MUST use Japanese restaurant naming: rolls, sashimi, teriyaki, ramen, or donburi. Do not generate generic 'Asian fusion' labels.",
  },
  indian: {
    id: "indian",
    label: "Indian",
    mustIncludeTerms: ["tikka", "masala", "curry", "dal", "naan", "biryani", "tandoor"],
    anchorItems: ["Chicken Tikka Masala", "Dal Makhani", "Tandoori Chicken", "Saag Paneer", "Vegetable Biryani", "Palak Paneer"],
    realistExample: "Tandoori Chicken, half portion, side of dal, no naan",
    menuRealism: "Meals MUST use authentic Indian dish names: tikka masala, saag, biryani, tandoori, dal. Do not generate 'Indian-style stew' or generic curry labels.",
  },
  thai: {
    id: "thai",
    label: "Thai",
    mustIncludeTerms: ["pad thai", "curry", "basil", "spring roll", "tom", "satay", "larb"],
    anchorItems: ["Pad Thai with Shrimp", "Green Curry with Tofu", "Chicken Satay", "Tom Kha Soup", "Fresh Spring Rolls", "Basil Chicken"],
    realistExample: "Pad Thai with grilled shrimp, no sugar added, extra lime",
    menuRealism: "Meals MUST use Thai dish names: pad thai, green/red/yellow curry, som tam, basil, satay. Never say 'Thai-style noodles.'",
  },
  mediterranean: {
    id: "mediterranean",
    label: "Mediterranean",
    mustIncludeTerms: ["gyro", "shawarma", "hummus", "falafel", "kabob", "pita", "fattoush", "tabbouleh"],
    anchorItems: ["Chicken Shawarma Plate", "Falafel Wrap", "Grilled Lamb Kabob", "Greek Salad", "Hummus Platter", "Gyro Pita"],
    realistExample: "Chicken Shawarma Plate, extra tabbouleh, no pita, tzatziki on the side",
    menuRealism: "Meals MUST use Mediterranean dish names: shawarma, gyro, kabob, falafel, hummus plate. Never say 'Mediterranean protein bowl.'",
  },
  korean: {
    id: "korean",
    label: "Korean",
    mustIncludeTerms: ["bibimbap", "bulgogi", "kimchi", "galbi", "japchae", "tofu jjigae", "kimbap"],
    anchorItems: ["Bibimbap", "Bulgogi Bowl", "Galbi Ribs", "Kimchi Jjigae", "Japchae", "Tofu Sundubu"],
    realistExample: "Bibimbap with tofu, extra vegetables, gochujang on the side, no egg",
    menuRealism: "Meals MUST use Korean dish names: bibimbap, bulgogi, galbi, jjigae, japchae. Do not substitute English descriptions for dish names.",
  },
  vietnamese: {
    id: "vietnamese",
    label: "Vietnamese",
    mustIncludeTerms: ["pho", "banh mi", "spring roll", "bun", "vermicelli", "bo luc lac"],
    anchorItems: ["Pho Ga (Chicken Pho)", "Shrimp Banh Mi", "Vermicelli Bowl", "Fresh Spring Rolls", "Lemongrass Tofu"],
    realistExample: "Pho Ga, extra vegetables, less noodles, hoisin on the side",
    menuRealism: "Meals MUST use Vietnamese dish names: pho, banh mi, bun, goi cuon. Never say 'Vietnamese-style soup.'",
  },
  bbq: {
    id: "bbq",
    label: "BBQ / American Smokehouse",
    mustIncludeTerms: ["brisket", "ribs", "pulled pork", "smoked chicken", "sausage", "burnt ends"],
    anchorItems: ["Smoked Brisket Plate", "Half Rack Ribs", "Pulled Chicken Sandwich", "Smoked Turkey Leg", "BBQ Chicken Salad"],
    realistExample: "Smoked Turkey Plate, side of coleslaw and green beans, no mac and cheese",
    menuRealism: "Meals MUST use BBQ naming: brisket, ribs, pulled pork, smoked. Do not return generic 'grilled protein' — use actual BBQ formats.",
  },
  greek: {
    id: "greek",
    label: "Greek",
    mustIncludeTerms: ["gyro", "souvlaki", "spanakopita", "moussaka", "horiatiki", "dolmades"],
    anchorItems: ["Chicken Souvlaki Plate", "Lamb Gyro", "Horiatiki Salad", "Grilled Octopus", "Spanakopita"],
    realistExample: "Chicken Souvlaki Plate, extra salad, pita on the side",
    menuRealism: "Meals MUST use Greek dish names: souvlaki, gyro, spanakopita, horiatiki. Do not use generic Mediterranean labels.",
  },
  sandwich: {
    id: "sandwich",
    label: "Sandwich / Sub",
    mustIncludeTerms: ["sandwich", "sub", "wrap", "panini", "hoagie"],
    anchorItems: ["Turkey Breast Sub", "Veggie Delight", "Grilled Chicken Wrap", "Tuna Sandwich", "Italian BMT"],
    realistExample: "6-inch Turkey Breast on whole wheat, no mayo, extra vegetables",
    menuRealism: "Meals MUST be named as sandwiches, subs, or wraps. Do not generate bowls or plates — this is a sandwich restaurant.",
  },
  cafe: {
    id: "cafe",
    label: "Cafe / Coffee Shop",
    mustIncludeTerms: ["wrap", "box", "panini", "sandwich", "salad", "egg bites"],
    anchorItems: ["Protein Box", "Spinach Feta Wrap", "Sous Vide Egg Bites", "Turkey Provolone Panini", "Chicken Quinoa Bowl"],
    realistExample: "Spinach Feta Wrap, protein box on the side",
    menuRealism: "Meals MUST use cafe-style naming: protein boxes, wraps, paninis, or egg-based items. These are grab-and-go formats.",
  },
  american_casual: {
    id: "american_casual",
    label: "American Casual",
    mustIncludeTerms: ["burger", "sandwich", "salad", "grilled chicken", "steak", "wrap"],
    anchorItems: ["Grilled Chicken Plate", "Classic Burger", "Caesar Salad with Grilled Chicken", "Salmon Fillet", "Turkey Club"],
    realistExample: "Grilled Chicken Sandwich, lettuce, tomato, no sauce, side salad instead of fries",
    menuRealism: "Meals should sound like American casual dining: burgers, grilled chicken, salads, sandwiches. Avoid overly fancy or overly fast-food language.",
  },
};

// ── Priority stack classifier ─────────────────────────────────────────────────
export function classifyRestaurantArchetype(
  restaurantName: string,
  placeTypes: string[] = [],
  searchQuery?: string
): ArchetypeResult {
  const nameLower = restaurantName.toLowerCase().trim();
  const typesLower = placeTypes.map((t) => t.toLowerCase());
  const queryLower = (searchQuery || "").toLowerCase();

  // Priority 1 — chain name match
  for (const chain of FAST_FOOD_CHAINS) {
    if (chain.namePatterns.some((p) => nameLower.includes(p))) {
      const archetype = ARCHETYPES[chain.archetype] ?? ARCHETYPES.american_casual;
      return {
        archetype,
        chainName: chain.chainLabel,
        chainPatterns: chain.anchorItems,
        confidence: "chain",
      };
    }
  }

  // Priority 2 — Google Places types
  const typeMap: Array<[string[], string]> = [
    [["mexican_restaurant", "mexican"], "mexican"],
    [["italian_restaurant", "italian"], "italian"],
    [["japanese_restaurant", "sushi_restaurant", "japanese"], "japanese"],
    [["chinese_restaurant", "chinese"], "chinese_american"],
    [["indian_restaurant", "indian"], "indian"],
    [["thai_restaurant", "thai"], "thai"],
    [["mediterranean_restaurant", "greek_restaurant"], "mediterranean"],
    [["korean_restaurant", "korean"], "korean"],
    [["vietnamese_restaurant", "vietnamese"], "vietnamese"],
    [["barbecue_restaurant", "bbq"], "bbq"],
    [["sandwich_restaurant", "sub_restaurant"], "sandwich"],
    [["hamburger_restaurant", "burger_restaurant"], "burger"],
    [["cafe", "coffee_shop", "bakery"], "cafe"],
  ];

  for (const [typeKeywords, archetypeId] of typeMap) {
    if (typeKeywords.some((kw) => typesLower.some((t) => t.includes(kw)))) {
      return { archetype: ARCHETYPES[archetypeId] ?? ARCHETYPES.american_casual, confidence: "types" };
    }
  }

  // Priority 3 — restaurant name keywords
  const nameKeywords: Array<[string[], string]> = [
    [["taco", "burrito", "cantina", "mexicana"], "mexican"],
    [["pizza", "pasta", "trattoria", "ristorante", "osteria"], "italian"],
    [["sushi", "ramen", "izakaya", "hibachi", "teriyaki"], "japanese"],
    [["pho", "banh mi", "viet"], "vietnamese"],
    [["wok", "dim sum", "dragon", "panda", "peking"], "chinese_american"],
    [["curry", "tandoor", "chai", "masala", "india"], "indian"],
    [["thai", "pad"], "thai"],
    [["pita", "gyro", "shawarma", "kabob", "falafel", "hummus", "mezze"], "mediterranean"],
    [["bbq", "barbecue", "smokehouse", "smoke"], "bbq"],
    [["burger", "burgers", "five guys", "smashburger"], "burger"],
    [["sandwich", "sub", "deli"], "sandwich"],
    [["cafe", "coffee", "brew", "roast"], "cafe"],
    [["seoul", "kim", "korean", "bibimbap"], "korean"],
  ];

  for (const [keywords, archetypeId] of nameKeywords) {
    if (keywords.some((kw) => nameLower.includes(kw))) {
      return { archetype: ARCHETYPES[archetypeId] ?? ARCHETYPES.american_casual, confidence: "name" };
    }
  }

  // Priority 4 — user search query
  const queryKeywords: Array<[string[], string]> = [
    [["taco", "burrito", "mexican"], "mexican"],
    [["pizza", "pasta", "italian"], "italian"],
    [["sushi", "japanese", "ramen"], "japanese"],
    [["burger", "hamburger"], "burger"],
    [["bbq", "barbecue", "ribs"], "bbq"],
    [["sandwich", "sub"], "sandwich"],
    [["thai"], "thai"],
    [["indian", "curry"], "indian"],
    [["chinese"], "chinese_american"],
    [["mediterranean", "gyro", "shawarma"], "mediterranean"],
    [["korean"], "korean"],
    [["vietnamese", "pho"], "vietnamese"],
  ];

  for (const [keywords, archetypeId] of queryKeywords) {
    if (keywords.some((kw) => queryLower.includes(kw))) {
      return { archetype: ARCHETYPES[archetypeId] ?? ARCHETYPES.american_casual, confidence: "query" };
    }
  }

  // Fallback
  return { archetype: ARCHETYPES.american_casual, confidence: "fallback" };
}

export function getArchetypeById(id: string): CuisineArchetype {
  return ARCHETYPES[id] ?? ARCHETYPES.american_casual;
}
