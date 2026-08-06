/**
 * Pediatric Test Scenario Index
 *
 * Exports all 110 scenarios across 21 groups.
 * Hard-stop scenarios: S001, S076–S081 (6 total) — must reach 100% pass rate
 * Soft scenarios: all others — must reach 95%+ aggregate pass rate
 */

import type { PediatricScenario } from "../types";

import { healthyChildrenScenarios }     from "./01-healthy-children";
import { peanutAllergyScenarios }       from "./02-peanut-allergy";
import { treeNutAllergyScenarios }      from "./03-tree-nut-allergy";
import { multipleAllergyScenarios }     from "./04-multiple-allergies";
import { celiacDiseaseScenarios }       from "./05-celiac-disease";
import { type1DiabetesScenarios }       from "./06-type1-diabetes";
import { type2DiabetesScenarios }       from "./07-type2-diabetes";
import { ironDeficiencyScenarios }      from "./08-iron-deficiency";
import { failureToThriveScenarios }     from "./09-failure-to-thrive";
import { pediatricObesityScenarios }    from "./10-pediatric-obesity";
import { adhdEatingScenarios }          from "./11-adhd-eating";
import { autismSensoryScenarios }       from "./12-autism-sensory";
import { crohnsDiseaseScenarios }       from "./13-crohns-disease";
import { ckdScenarios }                 from "./14-ckd";
import { cysticFibrosisScenarios }      from "./15-cystic-fibrosis";
import { hardStopScenarios }            from "./16-hard-stops";
import { behavioralFeedingScenarios }   from "./17-behavioral-feeding";
import { familyMealScenarios }          from "./18-family-meals";
import { mealContextScenarios }         from "./19-meal-contexts";
import { parentControlScenarios }       from "./20-parent-controls";
import { multipleConditionScenarios }   from "./21-multiple-conditions";

export const ALL_SCENARIOS: PediatricScenario[] = [
  ...healthyChildrenScenarios,      //  8  S001–S008
  ...peanutAllergyScenarios,        //  7  S009–S015
  ...treeNutAllergyScenarios,       //  5  S016–S020
  ...multipleAllergyScenarios,      //  8  S021–S028
  ...celiacDiseaseScenarios,        //  5  S029–S033
  ...type1DiabetesScenarios,        //  5  S034–S038
  ...type2DiabetesScenarios,        //  5  S039–S043
  ...ironDeficiencyScenarios,       //  4  S044–S047
  ...failureToThriveScenarios,      //  4  S048–S051
  ...pediatricObesityScenarios,     //  5  S052–S056
  ...adhdEatingScenarios,           //  4  S057–S060
  ...autismSensoryScenarios,        //  4  S061–S064
  ...crohnsDiseaseScenarios,        //  4  S065–S068
  ...ckdScenarios,                  //  4  S069–S072
  ...cysticFibrosisScenarios,       //  3  S073–S075
  ...hardStopScenarios,             //  6  S076–S081
  ...behavioralFeedingScenarios,    //  6  S082–S087
  ...familyMealScenarios,           //  4  S088–S091
  ...mealContextScenarios,          //  5  S092–S096
  ...parentControlScenarios,        //  4  S097–S100
  ...multipleConditionScenarios,    // 10  S101–S110
];

export const HARD_STOP_SCENARIOS = ALL_SCENARIOS.filter(s => s.expectHardStop);
export const SOFT_SCENARIOS      = ALL_SCENARIOS.filter(s => !s.expectHardStop);

export {
  healthyChildrenScenarios,
  peanutAllergyScenarios,
  treeNutAllergyScenarios,
  multipleAllergyScenarios,
  celiacDiseaseScenarios,
  type1DiabetesScenarios,
  type2DiabetesScenarios,
  ironDeficiencyScenarios,
  failureToThriveScenarios,
  pediatricObesityScenarios,
  adhdEatingScenarios,
  autismSensoryScenarios,
  crohnsDiseaseScenarios,
  ckdScenarios,
  cysticFibrosisScenarios,
  hardStopScenarios,
  behavioralFeedingScenarios,
  familyMealScenarios,
  mealContextScenarios,
  parentControlScenarios,
  multipleConditionScenarios,
};
