export type SwapChip = { id: string; text: string; whenTags: string[] };
export const MEN_SWAP_CHIPS: SwapChip[] = [
  { id:"extra-lean-pro", text:"Add 2–3 oz extra lean protein", whenTags:["protein-forward","protein-30to45"] },
  { id:"fries-roast", text:"Swap fries → roasted potatoes/veg", whenTags:["protein-veg-first"] },
  { id:"half-beans", text:"Half rice → half beans/quinoa", whenTags:["high-fiber-carb"] },
  { id:"olive-nuts", text:"Add olive oil or nuts", whenTags:["metabolic","protein-forward"] },
  { id:"oysters-sardines", text:"Plan oysters/sardines 1× this week", whenTags:["zinc-rich","selenium-source","omega-3"] },
  { id:"unsweet", text:"Choose unsweetened beverage", whenTags:["lower-added-sugar"] },
  { id:"caffeine-earlier", text:"Move caffeine earlier in day", whenTags:["caffeine-earlier"] },
];
