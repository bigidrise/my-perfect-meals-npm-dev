export type SwapChip = { id: string; text: string; whenTags: string[] };
export const WOMEN_SWAP_CHIPS: SwapChip[] = [
  { id: "add-flax", text: "+2 tbsp ground flax (fiber)", whenTags: ["cycle-aware","high-fiber-carb"] },
  { id: "cooked-veg", text: "Swap raw salad → cooked veg", whenTags: ["easy-on-bloat"] },
  { id: "lower-sodium", text: "Choose lower-sodium option", whenTags: ["cycle-aware"] },
  { id: "add-greek-yogurt", text: "Add Greek yogurt for +15g protein", whenTags: ["protein-forward"] },
  { id: "whole-fruit", text: "Swap juice → whole fruit", whenTags: ["lower-added-sugar","slow-release"] },
  { id: "olive-oil", text: "Add olive oil or nuts for steady energy", whenTags: ["stable-energy"] },
  { id: "soy-legume", text: "Add tofu/tempeh/edamame", whenTags: ["phyto-friendly"] },
  { id: "fish-weekly", text: "Plan fatty fish 1–2× this week", whenTags: ["omega-3"] },
  { id: "sprouted-grain", text: "Swap white bread → sprouted grain", whenTags: ["protein-calcium","phyto-friendly"] },
  { id: "half-grain-half-bean", text: "Half rice → half beans/quinoa", whenTags: ["high-fiber-carb","protein-veg-first"] },
  { id: "unsweetened", text: "Choose unsweetened beverage", whenTags: ["lower-added-sugar"] },
];
