// data/smartMenu.snacks.ts
import type { SmartMeal } from "./smartMenu.types";

// src/data/smartMenu.snacks.ts
import type { SmartMeal } from "./smartMenu.types";

export const smartMenuSnacks: SmartMeal[] = [
  {
    id: "sn-001",
    name: "Greek Yogurt & Berries",
    macros: { calories: 180, protein_g: 15, carbs_g: 18, fat_g: 4 },
    badges: ["High Protein", "Diabetes-Friendly"],
    image: "/images/smart-menu/snacks/greek-yogurt-berries.jpg",
    ingredients: [
      { item: "nonfat Greek yogurt", amount: "3/4 cup (170 g)" },
      { item: "mixed berries", amount: "1/2 cup (75 g)" },
    ],
    instructions: ["Spoon yogurt into a bowl.", "Top with berries."],
  },
  {
    id: "sn-002",
    name: "Apple Slices with Almond Butter",
    macros: { calories: 210, protein_g: 5, carbs_g: 22, fat_g: 12 },
    badges: ["Healthy Fats", "Low Sugar"],
    image: "/images/smart-menu/snacks/apple-almondbutter.jpg",
    ingredients: [
      { item: "apple", amount: "1 medium (150 g)" },
      { item: "almond butter", amount: "1 tbsp (16 g)" },
    ],
    instructions: ["Core and slice apple.", "Dip slices in almond butter."],
  },
  {
    id: "sn-003",
    name: "Protein Shake (Whey or Plant)",
    macros: { calories: 200, protein_g: 25, carbs_g: 6, fat_g: 6 },
    badges: ["Quick", "On-the-Go"],
    image: "/images/smart-menu/snacks/protein-shake.jpg",
    ingredients: [
      { item: "protein powder", amount: "1 scoop (30 g)" },
      { item: "unsweetened almond milk", amount: "1 cup (240 ml)" },
    ],
    instructions: [
      "Combine in shaker or blender.",
      "Shake/blend until smooth.",
    ],
  },
  {
    id: "sn-004",
    name: "Veggie Sticks with Hummus",
    macros: { calories: 160, protein_g: 6, carbs_g: 16, fat_g: 8 },
    badges: ["Plant-Based", "Fiber-Rich"],
    image: "/images/smart-menu/snacks/veggies-hummus.jpg",
    ingredients: [
      { item: "carrot sticks", amount: "1/2 cup (60 g)" },
      { item: "cucumber slices", amount: "1/2 cup (60 g)" },
      { item: "hummus", amount: "3 tbsp (45 g)" },
    ],
    instructions: [
      "Arrange veggies on a plate.",
      "Serve with hummus for dipping.",
    ],
  },
  {
    id: "sn-005",
    name: "Cottage Cheese & Pineapple",
    macros: { calories: 190, protein_g: 16, carbs_g: 20, fat_g: 5 },
    badges: ["High Protein", "Refreshing"],
    image: "/images/smart-menu/snacks/cottage-pineapple.jpg",
    ingredients: [
      { item: "low-fat cottage cheese", amount: "1/2 cup (110 g)" },
      { item: "pineapple chunks", amount: "1/2 cup (80 g)" },
    ],
    instructions: ["Spoon cottage cheese into a bowl.", "Top with pineapple."],
  },
  {
    id: "sn-006",
    name: "Rice Cakes with Peanut Butter & Banana",
    macros: { calories: 220, protein_g: 6, carbs_g: 30, fat_g: 8 },
    badges: ["Quick Energy", "Balanced"],
    image: "/images/smart-menu/snacks/ricecake-banana.jpg",
    ingredients: [
      { item: "rice cake", amount: "2 cakes (18 g each)" },
      { item: "peanut butter", amount: "1 tbsp (16 g)" },
      { item: "banana slices", amount: "1/2 banana (50 g)" },
    ],
    instructions: [
      "Spread peanut butter on rice cakes.",
      "Top with banana slices.",
    ],
  },
  {
    id: "sn-007",
    name: "Hard-Boiled Eggs & Carrots",
    macros: { calories: 150, protein_g: 12, carbs_g: 6, fat_g: 8 },
    badges: ["Simple", "Portable"],
    image: "/images/smart-menu/snacks/eggs-carrots.jpg",
    ingredients: [
      { item: "hard-boiled eggs", amount: "2 large" },
      { item: "baby carrots", amount: "1/2 cup (60 g)" },
    ],
    instructions: ["Peel eggs.", "Serve with carrots."],
  },
  {
    id: "sn-008",
    name: "Trail Mix (Homemade Light)",
    macros: { calories: 210, protein_g: 7, carbs_g: 18, fat_g: 12 },
    badges: ["Healthy Fats", "Fiber"],
    image: "/images/smart-menu/snacks/trail-mix.jpg",
    ingredients: [
      { item: "unsalted nuts", amount: "1/4 cup (28 g)" },
      { item: "dried cranberries (low sugar)", amount: "2 tbsp (16 g)" },
      { item: "pumpkin seeds", amount: "1 tbsp (10 g)" },
    ],
    instructions: ["Mix nuts, seeds, and cranberries in a small bowl."],
  },
  {
    id: "sn-009",
    name: "Turkey & Cheese Roll-Ups",
    macros: { calories: 180, protein_g: 18, carbs_g: 2, fat_g: 10 },
    badges: ["Low Carb", "Keto-Friendly"],
    image: "/images/smart-menu/snacks/turkey-rollups.jpg",
    ingredients: [
      { item: "sliced turkey breast", amount: "3 oz (85 g)" },
      { item: "cheddar cheese slice", amount: "1 slice (20 g)" },
    ],
    instructions: ["Layer turkey and cheese.", "Roll tightly and slice."],
  },
  {
    id: "sn-010",
    name: "Chia Pudding (Vanilla)",
    macros: { calories: 190, protein_g: 8, carbs_g: 22, fat_g: 8 },
    badges: ["High Fiber", "Omega-3"],
    image: "/images/smart-menu/snacks/chia-pudding.jpg",
    ingredients: [
      { item: "chia seeds", amount: "3 tbsp (30 g)" },
      { item: "unsweetened almond milk", amount: "3/4 cup (180 ml)" },
      { item: "vanilla extract", amount: "1/4 tsp" },
    ],
    instructions: [
      "Mix chia seeds, almond milk, and vanilla.",
      "Refrigerate at least 2 hours until thickened.",
    ],
  },
];

export default smartMenuSnacks;
