import type { WalkthroughScript } from "./WalkthroughTypes";
import WeeklyMealBuilderScript from "./scripts/WeeklyMealBuilderScript";
import DiabeticMealBuilderScript from "./scripts/DiabeticMealBuilderScript";
import GLP1MealBuilderScript from "./scripts/GLP1MealBuilderScript";
import AntiInflammatoryMealBuilderScript from "./scripts/AntiInflammatoryMealBuilderScript";
import BeachBodyMealBuilderScript from "./scripts/BeachBodyMealBuilderScript";
import MacroCalculatorScript from "./scripts/MacroCalculatorScript";
import BiometricsWalkthroughScript from "./scripts/BiometricsWalkthroughScript";
import MasterShoppingListScript from "./scripts/MasterShoppingListScript";
import CravingPremadesScript from "./scripts/CravingPremadesScript";
import KidsMealsScript from "./scripts/KidsMealsScript";
import ToddlerMealsScript from "./scripts/ToddlerMealsScript";
import RestaurantGuideScript from "./scripts/RestaurantGuideScript";
import CravingCreatorScript from "./scripts/CravingCreatorScript";
import LeanSocialScript from "./scripts/LeanSocialScript";
import MocktailsScript from "./scripts/MocktailsScript";
import WinePairingScript from "./scripts/WinePairingScript";
import BeerPairingScript from "./scripts/BeerPairingScript";
import BourbonPairingScript from "./scripts/BourbonPairingScript";
import AlcoholLogScript from "./scripts/AlcoholLogScript";
import FindMealsScript from "./scripts/FindMealsScript";
import MealPairingScript from "./scripts/MealPairingScript";
import WeaningOffScript from "./scripts/WeaningOffScript";
import CravingHubWalkthroughScript from "./scripts/CravingHubWalkthroughScript";
import KidsHubWalkthroughScript from "./scripts/KidsHubWalkthroughScript";
import AlcoholHubWalkthroughScript from "./scripts/AlcoholHubWalkthroughScript";
import SocialHubWalkthroughScript from "./scripts/SocialHubWalkthroughScript";
import FridgeRescueWalkthroughScript from "./scripts/FridgeRescueWalkthroughScript";
import MacroCalculatorWalkthroughScript from "./scripts/MacroCalculatorWalkthroughScript";
import ShoppingListWalkthroughScript from "./scripts/ShoppingListWalkthroughScript";
import InspirationWalkthroughScript from "./scripts/InspirationWalkthroughScript";

/**
 * Central registry for all walkthrough scripts
 * Add new scripts here as they are created
 */
export const ScriptRegistry: Record<string, WalkthroughScript> = {
  // Weekly Meal Builder
  "weekly-meal-builder": WeeklyMealBuilderScript,
  "weekly-board": WeeklyMealBuilderScript,
  "meal-board": WeeklyMealBuilderScript,
  
  // Diabetic Meal Builder
  "diabetic-meal-builder": DiabeticMealBuilderScript,
  "diabetic-board": DiabeticMealBuilderScript,
  
  // GLP-1 Meal Builder
  "glp1-meal-builder": GLP1MealBuilderScript,
  "glp-1-board": GLP1MealBuilderScript,
  
  // Anti-Inflammatory Meal Builder
  "anti-inflammatory-meal-builder": AntiInflammatoryMealBuilderScript,
  "anti-inflammatory-board": AntiInflammatoryMealBuilderScript,
  
  // Beach Body / Hard Body Builder
  "beach-body-meal-builder": BeachBodyMealBuilderScript,
  "beach-body-board": BeachBodyMealBuilderScript,
  "hard-body-board": BeachBodyMealBuilderScript,
  
  // My Biometrics (QUARANTINED - NOT IN USE)
  "biometrics-walkthrough": BiometricsWalkthroughScript,
  "my-biometrics": BiometricsWalkthroughScript,
  "biometrics": BiometricsWalkthroughScript,
  
  // Craving Premades
  "craving-premades-walkthrough": CravingPremadesScript,
  "craving-premades": CravingPremadesScript,
  "premade-cravings": CravingPremadesScript,
  
  // Kids Meals
  "kids-meals-walkthrough": KidsMealsScript,
  "kids-meals": KidsMealsScript,
  "kids-meals-hub": KidsMealsScript,
  
  // Toddler Meals
  "toddler-meals-walkthrough": ToddlerMealsScript,
  "toddler-meals": ToddlerMealsScript,
  "toddlers-meals": ToddlerMealsScript,
  
  // Restaurant Guide
  "restaurant-guide-walkthrough": RestaurantGuideScript,
  "restaurant-guide": RestaurantGuideScript,
  "restaurant": RestaurantGuideScript,
  
  // Phase C.5: Craving Creator
  "craving-creator-walkthrough": CravingCreatorScript,
  "craving-creator": CravingCreatorScript,
  
  // Phase C.5: Lean & Social
  "lean-social-walkthrough": LeanSocialScript,
  "lean-social": LeanSocialScript,
  "lean-and-social": LeanSocialScript,
  
  // Phase C.5: Mocktails
  "mocktails-walkthrough": MocktailsScript,
  "mocktails": MocktailsScript,
  
  // Phase C.5: Wine Pairing
  "wine-pairing-walkthrough": WinePairingScript,
  "wine-pairing": WinePairingScript,
  "wine": WinePairingScript,
  
  // Phase C.5: Beer Pairing
  "beer-pairing-walkthrough": BeerPairingScript,
  "beer-pairing": BeerPairingScript,
  "beer": BeerPairingScript,
  
  // Phase C.5: Bourbon Pairing
  "bourbon-pairing-walkthrough": BourbonPairingScript,
  "bourbon-pairing": BourbonPairingScript,
  "bourbon": BourbonPairingScript,
  
  // Phase C.5: Alcohol Log
  "alcohol-log-walkthrough": AlcoholLogScript,
  "alcohol-log": AlcoholLogScript,
  "alog": AlcoholLogScript,
  
  // Phase C.5: Find Meals Near Me
  "find-meals-walkthrough": FindMealsScript,
  "find-meals": FindMealsScript,
  "find": FindMealsScript,
  
  // Phase C.5: Meal Pairing
  "meal-pairing-walkthrough": MealPairingScript,
  "meal-pairing": MealPairingScript,
  
  // Phase C.5: Weaning Off Tool
  "weaning-off-walkthrough": WeaningOffScript,
  "weaning-off": WeaningOffScript,
  "weaning": WeaningOffScript,
  
  // Phase C.7: Hub Walkthroughs
  "craving-hub-walkthrough": CravingHubWalkthroughScript,
  "craving-hub": CravingHubWalkthroughScript,
  "cravings-hub": CravingHubWalkthroughScript,
  
  "kids-hub-walkthrough": KidsHubWalkthroughScript,
  "kids-hub": KidsHubWalkthroughScript,
  "healthy-kids": KidsHubWalkthroughScript,
  
  "alcohol-hub-walkthrough": AlcoholHubWalkthroughScript,
  "alcohol-hub": AlcoholHubWalkthroughScript,
  "spirits-hub": AlcoholHubWalkthroughScript,
  
  "social-hub-walkthrough": SocialHubWalkthroughScript,
  "social-hub": SocialHubWalkthroughScript,
  "socializing-hub": SocialHubWalkthroughScript,
  "socializing": SocialHubWalkthroughScript,
  
  // Phase C.8: Single-Page Feature Walkthroughs
  "fridge-rescue-walkthrough": FridgeRescueWalkthroughScript,
  "fridge-rescue": FridgeRescueWalkthroughScript,
  "fridge": FridgeRescueWalkthroughScript,
  
  "macro-calculator-walkthrough": MacroCalculatorWalkthroughScript, // REPLACES old MacroCalculatorScript
  "macro-calculator": MacroCalculatorWalkthroughScript,
  "macros": MacroCalculatorWalkthroughScript,
  
  "shopping-list-walkthrough": ShoppingListWalkthroughScript, // REPLACES old MasterShoppingListScript
  "shopping-list": ShoppingListWalkthroughScript,
  "master-shopping-list": ShoppingListWalkthroughScript,
  "shopping": ShoppingListWalkthroughScript,
  
  "inspiration-walkthrough": InspirationWalkthroughScript,
  "inspiration": InspirationWalkthroughScript,
  "get-inspiration": InspirationWalkthroughScript,
};

/**
 * Get a script by ID or alias
 */
export function getScript(id: string): WalkthroughScript | null {
  return ScriptRegistry[id] || null;
}

/**
 * Check if a script exists
 */
export function hasScript(id: string): boolean {
  return id in ScriptRegistry;
}
