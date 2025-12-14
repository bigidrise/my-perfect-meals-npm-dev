import { Meal } from "@/components/MealCard";

export interface CompetitionPremadeOption {
  id: string;
  category: "protein-only" | "protein-fibrous" | "protein-fibrous-starchy";
  title: string;
  protein_g: number;
  fibrous_g: number | null;
  starchy_g: number | null;
  ingredient: string;
}

// CATEGORY 1: PROTEIN ONLY (20 OPTIONS)
// All options = 30g protein, zero carbs
export const proteinOnlyOptions: CompetitionPremadeOption[] = [
  { id:"po-chicken", category:"protein-only", title:"Chicken Breast (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Chicken breast" },
  { id:"po-turkey", category:"protein-only", title:"Lean Turkey (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Lean turkey" },
  { id:"po-sirloin", category:"protein-only", title:"Top Sirloin (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Top sirloin" },
  { id:"po-eggwhites", category:"protein-only", title:"Egg Whites (10)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Egg whites" },
  { id:"po-cod", category:"protein-only", title:"Cod Filet (5 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Cod" },
  { id:"po-tilapia", category:"protein-only", title:"Tilapia (5 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Tilapia" },
  { id:"po-salmon", category:"protein-only", title:"Salmon (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Salmon" },
  { id:"po-shrimp", category:"protein-only", title:"Shrimp (6 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Shrimp" },
  { id:"po-tuna", category:"protein-only", title:"Tuna (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Tuna" },
  { id:"po-venison", category:"protein-only", title:"Venison (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Venison" },
  { id:"po-bison", category:"protein-only", title:"Ground Bison 93% (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Bison" },
  { id:"po-haddock", category:"protein-only", title:"Haddock (5 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Haddock" },
  { id:"po-greekyogurt", category:"protein-only", title:"Greek Yogurt (1.5 cups)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Greek yogurt" },
  { id:"po-cottage", category:"protein-only", title:"Cottage Cheese (1 cup)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Cottage cheese" },
  { id:"po-chickpeas", category:"protein-only", title:"Chickpeas (1.5 cups)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Chickpeas" },
  { id:"po-tofu", category:"protein-only", title:"Firm Tofu (10 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Tofu" },
  { id:"po-tempeh", category:"protein-only", title:"Tempeh (5 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Tempeh" },
  { id:"po-whey", category:"protein-only", title:"Whey Shake (1.5 scoops)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Whey protein" },
  { id:"po-casein", category:"protein-only", title:"Casein Shake (1.5 scoops)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Casein protein" },
  { id:"po-seitan", category:"protein-only", title:"Seitan (4 oz)", protein_g:30, fibrous_g:null, starchy_g:null, ingredient:"Seitan" },
];

// CATEGORY 2: PROTEIN + FIBROUS CARBS (20 OPTIONS)
// All options = 30g protein + 100g fibrous carbs (2 cups)
export const proteinFibrousOptions: CompetitionPremadeOption[] = [
  { id:"pf-chicken-broccoli", category:"protein-fibrous", title:"Chicken + Broccoli", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Chicken + broccoli" },
  { id:"pf-turkey-asparagus", category:"protein-fibrous", title:"Turkey + Asparagus", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Turkey + asparagus" },
  { id:"pf-salmon-spinach", category:"protein-fibrous", title:"Salmon + Spinach", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Salmon + spinach" },
  { id:"pf-cod-greens", category:"protein-fibrous", title:"Cod + Mixed Greens", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Cod + mixed greens" },
  { id:"pf-bison-zucchini", category:"protein-fibrous", title:"Bison + Zucchini", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Bison + zucchini" },
  { id:"pf-sirloin-broccolini", category:"protein-fibrous", title:"Sirloin + Broccolini", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Sirloin + broccolini" },
  { id:"pf-shrimp-greenbeans", category:"protein-fibrous", title:"Shrimp + Green Beans", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Shrimp + green beans" },
  { id:"pf-tuna-cabbage", category:"protein-fibrous", title:"Tuna + Cabbage", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Tuna + cabbage" },
  { id:"pf-eggwhites-kale", category:"protein-fibrous", title:"Egg Whites + Kale", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Egg whites + kale" },
  { id:"pf-greekyogurt-berries", category:"protein-fibrous", title:"Greek Yogurt + Berries", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Greek yogurt + berries" },
  { id:"pf-cottage-tomato", category:"protein-fibrous", title:"Cottage Cheese + Tomato", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Cottage cheese + tomato" },
  { id:"pf-salmon-brussels", category:"protein-fibrous", title:"Salmon + Brussels Sprouts", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Salmon + Brussels sprouts" },
  { id:"pf-tofu-bokchoy", category:"protein-fibrous", title:"Tofu + Bok Choy", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Tofu + bok choy" },
  { id:"pf-tempeh-cauliflower", category:"protein-fibrous", title:"Tempeh + Cauliflower", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Tempeh + cauliflower" },
  { id:"pf-whitefish-spinach", category:"protein-fibrous", title:"Whitefish + Spinach", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"White fish + spinach" },
  { id:"pf-haddock-greens", category:"protein-fibrous", title:"Haddock + Leafy Greens", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Haddock + leafy greens" },
  { id:"pf-venison-asparagus", category:"protein-fibrous", title:"Venison + Asparagus", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Venison + asparagus" },
  { id:"pf-scallops-zoodles", category:"protein-fibrous", title:"Scallops + Zoodles", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Scallops + zucchini noodles" },
  { id:"pf-proteinshake-spinach", category:"protein-fibrous", title:"Shake + Spinach", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Whey shake + spinach" },
  { id:"pf-seitan-greens", category:"protein-fibrous", title:"Seitan + Greens", protein_g:30, fibrous_g:100, starchy_g:null, ingredient:"Seitan + mixed greens" },
];

// CATEGORY 3: PROTEIN + FIBROUS + STARCHY (20 OPTIONS)
// All options = 30g protein + 100g fibrous + 25g starchy
export const proteinFibrousStarchyOptions: CompetitionPremadeOption[] = [
  { id:"pfs-chicken-rice-broccoli", category:"protein-fibrous-starchy", title:"Chicken + Rice + Broccoli", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Chicken + broccoli + rice" },
  { id:"pfs-turkey-potato-greenbeans", category:"protein-fibrous-starchy", title:"Turkey + Sweet Potato + Green Beans", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Turkey + green beans + sweet potato" },
  { id:"pfs-salmon-quinoa-asparagus", category:"protein-fibrous-starchy", title:"Salmon + Quinoa + Asparagus", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Salmon + asparagus + quinoa" },
  { id:"pfs-cod-rice-zucchini", category:"protein-fibrous-starchy", title:"Cod + Rice + Zucchini", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Cod + zucchini + rice" },
  { id:"pfs-bison-potato-broccoli", category:"protein-fibrous-starchy", title:"Bison + Potato + Broccoli", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Bison + potato + broccoli" },
  { id:"pfs-sirloin-rice-spinach", category:"protein-fibrous-starchy", title:"Sirloin + Rice + Spinach", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Sirloin + spinach + rice" },
  { id:"pfs-shrimp-rice-asparagus", category:"protein-fibrous-starchy", title:"Shrimp + Rice + Asparagus", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Shrimp + asparagus + rice" },
  { id:"pfs-tuna-potato-greens", category:"protein-fibrous-starchy", title:"Tuna + Potato + Greens", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Tuna + potato + greens" },
  { id:"pfs-eggwhites-oats-berries", category:"protein-fibrous-starchy", title:"Egg Whites + Oats + Berries", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Egg whites + oats + berries" },
  { id:"pfs-greekyogurt-granola-berries", category:"protein-fibrous-starchy", title:"Greek Yogurt + Granola + Berries", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Yogurt + granola + berries" },
  { id:"pfs-cottage-rice-cucumber", category:"protein-fibrous-starchy", title:"Cottage Cheese + Rice + Cucumber", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Cottage cheese + rice + cucumber" },
  { id:"pfs-tofu-rice-bokchoy", category:"protein-fibrous-starchy", title:"Tofu + Rice + Bok Choy", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Tofu + rice + bok choy" },
  { id:"pfs-tempeh-quinoa-greens", category:"protein-fibrous-starchy", title:"Tempeh + Quinoa + Greens", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Tempeh + quinoa + greens" },
  { id:"pfs-whitefish-grits-asparagus", category:"protein-fibrous-starchy", title:"White Fish + Grits + Asparagus", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"White fish + grits + asparagus" },
  { id:"pfs-venison-potato-brussels", category:"protein-fibrous-starchy", title:"Venison + Potato + Brussels", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Venison + potato + Brussels" },
  { id:"pfs-haddock-rice-spinach", category:"protein-fibrous-starchy", title:"Haddock + Rice + Spinach", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Haddock + rice + spinach" },
  { id:"pfs-scallops-quinoa-broccoli", category:"protein-fibrous-starchy", title:"Scallops + Quinoa + Broccoli", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Scallops + quinoa + broccoli" },
  { id:"pfs-whey-oats-spinach", category:"protein-fibrous-starchy", title:"Whey Shake + Oats + Spinach", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Whey + oats + spinach" },
  { id:"pfs-casein-rice-berries", category:"protein-fibrous-starchy", title:"Casein Shake + Rice + Berries", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Casein + rice + berries" },
  { id:"pfs-seitan-rice-kale", category:"protein-fibrous-starchy", title:"Seitan + Rice + Kale", protein_g:30, fibrous_g:100, starchy_g:25, ingredient:"Seitan + rice + kale" },
];

// Convert competition premade to Meal object
export function competitionPremadeToMeal(option: CompetitionPremadeOption): Meal {
  const protein = option.protein_g;
  const carbs = (option.fibrous_g || 0) + (option.starchy_g || 0);
  const fat = protein * 0.1; // Estimate ~10% of protein as fat
  const calories = (protein * 4) + (carbs * 4) + (fat * 9);

  return {
    id: `premade-${option.id}-${Date.now()}`,
    title: option.title,
    name: option.title,
    servings: 1,
    ingredients: [{ name: option.ingredient, qty: 1, unit: "serving" }],
    instructions: [],
    nutrition: {
      calories: Math.round(calories),
      protein: protein,
      carbs: carbs,
      fat: Math.round(fat),
    },
    entryType: "recipe",
  };
}

// All competition premades combined
export const allCompetitionPremades: CompetitionPremadeOption[] = [
  ...proteinOnlyOptions,
  ...proteinFibrousOptions,
  ...proteinFibrousStarchyOptions,
];
