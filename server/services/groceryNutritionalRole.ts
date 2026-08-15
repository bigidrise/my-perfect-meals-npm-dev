/**
 * Deterministic nutritional role classifier for grocery ingredients.
 *
 * Rules first — covers the overwhelming majority of grocery items with zero
 * AI cost. The "other" fallback tells the swap prompt to infer role from
 * context (meal name + remaining ingredients) rather than spending an AI call.
 *
 * Test matrix (must pass):
 *   chicken breast  → lean_protein
 *   broccoli        → fibrous_vegetable
 *   brown rice      → starchy_carb
 *   olive oil       → healthy_fat
 *   greek yogurt    → dairy
 */

export type NutritionalRole =
  | "lean_protein"       // chicken breast, cod, shrimp, egg whites, turkey breast
  | "fatty_protein"      // salmon, beef, whole eggs, pork, lamb, chicken thigh
  | "plant_protein"      // tofu, lentils, beans, tempeh, seitan, edamame
  | "fibrous_vegetable"  // broccoli, spinach, kale, zucchini, peppers, mushrooms
  | "starchy_carb"       // rice, pasta, potato, bread, oats, quinoa, tortilla
  | "healthy_fat"        // olive oil, avocado, nuts, seeds, nut butters, tahini
  | "dairy"              // yogurt, milk, cheese, cottage cheese, kefir, cream
  | "fruit"              // berries, banana, apple, mango, citrus
  | "condiment"          // sauces, spices, vinegars, marinades
  | "other";             // anything not covered — prompt infers from meal context

interface RoleRule {
  role: NutritionalRole;
  terms: RegExp;
}

const ROLE_RULES: RoleRule[] = [
  // ── Condiments / flavoring — FIRST so "soy sauce" hits here, not plant_protein ──
  {
    role: "condiment",
    terms: /\b(sauce|dressing|vinegar|mustard|ketchup|mayo|mayonnaise|soy\s+sauce|tamari|coconut\s+aminos|hot\s+sauce|sriracha|salsa|pesto|hummus|tzatziki|aioli|chimichurri|spice|herb|salt\b|pepper\b|garlic\s+powder|onion\s+powder|cumin|paprika|turmeric|oregano|basil|thyme|rosemary|cinnamon|chili\s+flake|bay\s+leaf|seasoning|marinade|rub|glaze|extract|vanilla|broth|stock|bouillon|tomato\s+paste|tomato\s+sauce|coconut\s+water|pickle|relish|capers|olives\b|miso|gochujang|harissa|worcestershire|fish\s+sauce)\b/i,
  },
  // ── Lean proteins (lower fat, high protein) ──────────────────────────────
  {
    role: "lean_protein",
    terms: /\b(chicken\s+breast|turkey\s+breast|turkey\s+cutlet|tilapia|cod|pollock|haddock|halibut|flounder|sole|perch|whiting|mahi[\s-]?mahi|shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|egg\s+white|tuna|canned\s+tuna|yellowfin|albacore|bison|venison|rabbit|lean\s+ground\s+turkey|99%\s+lean)\b/i,
  },
  // ── Fatty proteins ────────────────────────────────────────────────────────
  {
    role: "fatty_protein",
    terms: /\b(salmon|beef|ground\s+beef|steak|ribeye|sirloin|flank|brisket|chuck|burger|pork|lamb|duck|chicken\s+thigh|chicken\s+leg|chicken\s+drumstick|dark\s+meat|whole\s+egg|eggs?\b|sardine|mackerel|herring|anchov|swordfish|trout|catfish|bacon|sausage|chorizo|pepperoni|prosciutto)\b/i,
  },
  // ── Plant proteins ────────────────────────────────────────────────────────
  {
    role: "plant_protein",
    terms: /\b(tofu|tempeh|seitan|lentils?|chickpeas?|garbanzo|black\s+beans?|kidney\s+beans?|pinto\s+beans?|navy\s+beans?|cannellini|white\s+beans?|edamame|soy\b|textured\s+vegetable\s+protein|tvp|protein\s+powder|nutritional\s+yeast|hemp\s+seed|hemp\s+protein|lupini|fava\s+beans?|split\s+peas?)\b/i,
  },
  // ── Fibrous vegetables ────────────────────────────────────────────────────
  {
    role: "fibrous_vegetable",
    terms: /\b(broccoli|spinach|kale|zucchini|courgette|cauliflower|brussels\s+sprout|asparagus|green\s+bean|snap\s+pea|snow\s+pea|celery|cucumber|lettuce|arugula|rocket|chard|swiss\s+chard|collard|bok\s+choy|cabbage|napa\s+cabbage|mushroom|bell\s+pepper|jalape[nñ]o|serrano|habanero|poblano|artichoke|eggplant|aubergine|tomato|carrot|beet|beetroot|radish|turnip|rutabaga|leek|fennel|endive|watercress|radicchio|jicama|daikon|okra|sauerkraut|kimchi)\b/i,
  },
  // ── Starchy carbs ─────────────────────────────────────────────────────────
  {
    role: "starchy_carb",
    terms: /\b(rice|brown\s+rice|white\s+rice|jasmine\s+rice|basmati|pasta|spaghetti|penne|fettuccine|linguine|rigatoni|orzo|macaroni|noodle|ramen|udon|soba|potato|sweet\s+potato|yam|bread|sourdough|whole\s+wheat|multigrain|bagel|english\s+muffin|pita|naan|tortilla|wrap|roll|bun|oat|oatmeal|rolled\s+oat|steel[\s-]cut|quinoa|couscous|barley|farro|bulgur|millet|polenta|cornmeal|grits|corn\s+tortilla|plantain|cassava|taro|yuca|breadcrumb|cracker|granola|cereal|muesli)\b/i,
  },
  // ── Healthy fats ──────────────────────────────────────────────────────────
  {
    role: "healthy_fat",
    terms: /\b(olive\s+oil|extra\s+virgin|avocado\s+oil|coconut\s+oil|avocado|nut\s+butter|almond\s+butter|peanut\s+butter|cashew\s+butter|sunflower\s+butter|walnut|almond|cashew|pecan|pistachio|macadamia|brazil\s+nut|hazelnut|pine\s+nut|flaxseed|chia\s+seed|hemp\s+seed|sunflower\s+seed|pumpkin\s+seed|sesame\s+seed|tahini|ghee|butter|coconut\s+cream|coconut\s+milk|full[\s-]fat\s+coconut)\b/i,
  },
  // ── Dairy ─────────────────────────────────────────────────────────────────
  {
    role: "dairy",
    terms: /\b(yogurt|greek\s+yogurt|skyr|kefir|milk|whole\s+milk|skim\s+milk|2%\s+milk|almond\s+milk|oat\s+milk|soy\s+milk|cheese|cottage\s+cheese|ricotta|cream\s+cheese|sour\s+cream|whipping\s+cream|heavy\s+cream|half[\s-]and[\s-]half|cheddar|mozzarella|feta|parmesan|parmigiano|gouda|brie|camembert|goat\s+cheese|provolone|swiss\s+cheese|monterey\s+jack|colby|whey|casein|queso)\b/i,
  },
  // ── Fruit — explicit suffixes so "blueberries" matches without \b break ──
  {
    role: "fruit",
    terms: /\b(berr(y|ies)|strawberr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|blackberr(y|ies)|cranberr(y|ies)|banana|apple|orange|mango|pineapple|grape|watermelon|cantaloupe|honeydew|melon|peach|nectarine|pear|plum|cherr(y|ies)|pomegranate|kiwi|lemon|lime|grapefruit|fig|date|papaya|guava|apricot|passion\s+fruit|dragonfruit|lychee|jackfruit|dried\s+fruit|raisin)\b/i,
  },
];

/**
 * Returns the nutritional role of a grocery item based on its name.
 * Pure function — no I/O, no AI calls.
 */
export function classifyNutritionalRole(itemName: string): NutritionalRole {
  const lower = itemName.toLowerCase().trim();
  for (const { role, terms } of ROLE_RULES) {
    if (terms.test(lower)) return role;
  }
  return "other";
}

/**
 * Human-readable label used in AI prompts to communicate the role constraint.
 */
export function nutritionalRoleLabel(role: NutritionalRole): string {
  const labels: Record<NutritionalRole, string> = {
    lean_protein:      "lean protein source (e.g., chicken breast, shrimp, cod, turkey)",
    fatty_protein:     "protein source with higher fat content (e.g., salmon, beef, eggs, pork)",
    plant_protein:     "plant-based protein source (e.g., tofu, lentils, beans, tempeh)",
    fibrous_vegetable: "fibrous vegetable (e.g., broccoli, spinach, zucchini, peppers)",
    starchy_carb:      "starchy carbohydrate (e.g., rice, pasta, potato, quinoa, bread)",
    healthy_fat:       "healthy fat source (e.g., olive oil, avocado, nuts, nut butter)",
    dairy:             "dairy or dairy alternative (e.g., yogurt, milk, cheese, kefir)",
    fruit:             "fruit (e.g., berries, banana, mango, apple)",
    condiment:         "condiment or flavoring agent (e.g., sauce, spice, vinegar, seasoning)",
    other:             "ingredient that serves the same meal role as the original",
  };
  return labels[role];
}
