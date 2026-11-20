import { useConsumerCopy } from "./useConsumerCopy";

/** Display-only labels for these closed, app-owned option catalogs.
 * Callers retain the original IDs/English values in requests and selections.
 * Never apply this map to user input, saved food, provider evidence or API errors.
 */
export function useCreatorOptionLabels(): Record<string, string> {
  const { t } = useConsumerCopy();
  return {
    Holiday: t("Holiday"), Camping: t("Camping"), Tailgating: t("Tailgating"),
    "Great Outdoors": t("Great Outdoors"),
    Thanksgiving: t("Thanksgiving"), Christmas: t("Christmas"), Kwanzaa: t("Kwanzaa"),
    Hanukkah: t("Hanukkah"), Eid: t("Eid"), Passover: t("Passover"),
    "New Year's": t("New Year's"), "Fourth of July": t("Fourth of July"),
    Trout: t("Trout"), Venison: t("Venison"), "Wild Mushrooms": t("Wild Mushrooms"),
    Blackberries: t("Blackberries"), Elk: t("Elk"), Salmon: t("Salmon"),
    Duck: t("Duck"), Rabbit: t("Rabbit"), Zucchini: t("Zucchini"), Eggs: t("Eggs"),
    "Wild Turkey": t("Wild Turkey"),
    "Simple Preparation": t("Simple Preparation"), "Complete Meal": t("Complete Meal"),
    "Gathering Experience": t("Gathering Experience"),
    Smoker: t("Smoker"), "Dutch Oven": t("Dutch Oven"), "Cast Iron": t("Cast Iron"),
    Campfire: t("Campfire"), "Open Flame": t("Open Flame"), Grill: t("Grill"),
    Starters: t("Starters"), Mains: t("Mains"), Sides: t("Sides"), Desserts: t("Desserts"),
    Vegan: t("Vegan"), Vegetarian: t("Vegetarian"), Pescatarian: t("Pescatarian"),
    Keto: t("Keto"), Paleo: t("Paleo"), "Gluten-Free": t("Gluten-Free"),
    Kosher: t("Kosher"), Halal: t("Halal"), Carnivore: t("Carnivore"),
    American: t("American"), "Soul Food": t("Soul Food"), Mexican: t("Mexican"),
    Italian: t("Italian"), Indian: t("Indian"), Chinese: t("Chinese"),
    Japanese: t("Japanese"), Mediterranean: t("Mediterranean"), Thai: t("Thai"),
    Korean: t("Korean"), "Middle Eastern": t("Middle Eastern"), Greek: t("Greek"),
    French: t("French"), Caribbean: t("Caribbean"), Vietnamese: t("Vietnamese"),
    Ethiopian: t("Ethiopian"),
  };
}
