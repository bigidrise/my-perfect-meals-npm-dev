// Synthetic fixture data only; never imported by application runtime code.
export const meal = {
  meal: {name:"Fixture vegetable and chicken bowl", description:"A long synthetic description for checking wrapping and scroll reachability. ".repeat(5), prepTime:"20 minutes",servings:2},
  reasoning:["Synthetic explanation for layout verification only."],
  macros:{calories:450,protein:35,carbs:40,fat:15},
  ownedIngredients:[],
  shoppingList:Array.from({length:12},(_,i)=>({item:`Fixture ingredient ${i+1} with a deliberately long descriptive name`,quantity:"1",unit:"cup",category:"Produce"})),
  followUpSuggestions:["More vegetables","Make it quicker"],servingCount:2,
};
const score = {verdict:"neutral",reason:"Synthetic layout evidence only."};
export const analysis = {
  alignmentGrade:"B",overallSummary:"Synthetic product detail text with a long explanation for scrolling. ".repeat(8),
  verdict:"Check the package",verdictLevel:"caution",
  scoreCards:{kids:score,adults:score,diet:score,fitnessGoal:score},
  outcomeCards:[],analysisProfile:[],betterAlternatives:[],
  ingredientDecoder:Array.from({length:16},(_,i)=>({name:`Synthetic ingredient ${i+1}`,plain:"A long ingredient explanation for a layout fixture.",flag:"ok"})),
  ingredientConsiderations:["Synthetic consideration for scrolling."],mayNotAlignWith:[],betterFor:[],householdNotes:[],
  educationalFooter:"Layout fixture, not food or clinical guidance.",
  extractedIngredients:["Synthetic ingredient"],highRiskFindings:[],ocrConfidenceLow:false,fallbackUsed:false,
  productName:"FixtureExtraLongUnbrokenProductIdentity".repeat(5),
  isFrontLabel:false,productNameMissing:false,analysisMethod:"by_name",
  profileFactorsUsed:[],whatMattersMost:["Synthetic result for responsive testing."],
};
