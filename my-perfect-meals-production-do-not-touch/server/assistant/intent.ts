export type Intent = "NAVIGATE" | "DO" | "QNA_HEALTH" | "SMALLTALK" | "BLOCKED";

// Navigation patterns - Enhanced for FitBrain Rush
const navRe = /(go|take|open|navigate|show|view|play|start|launch)\s+(me\s+)?(to|into)?\s*(fitbrain|trivia|game|the game|the trivia|shopping list|meal calendar|calendar|craving|fridge|water|log|blood sugar|glucose|diabetes)/i;

// Action patterns
const doAddRe = /(add|put)\s+([\d\.]+\s*(lb|lbs|oz|g|kg|units?|cups?|tbsp|tsp)\s+)?(.+?)\s+(to\s+)?(my\s+)?(shopping\s+list)/i;
const doActionRe = /(start|begin|create|make|complete)\s+(challenge|workout|meal|plan)/i;

// Health/nutrition question patterns
const proteinRe = /(how much|target|need).*(protein)/i;
const nutritionRe = /(calories|macros|nutrition|vitamins|minerals|fiber|carbs|fat)/i;
const fitnessRe = /(workout|exercise|training|fitness|muscle|strength)/i;
const mindsetRe = /(habit|motivation|focus|stress|mindset|psychology)/i;

// Safety patterns - medical emergencies or dangerous content
const dangerRe = /(chest pain|heart attack|fainting|passing out|blood in stool|eating disorder|anorexia|bulimia|severe|emergency|can't breathe|allergic reaction)/i;

export function classify(utterance: string): Intent {
  const text = utterance.trim();

  // Safety first - block dangerous medical content
  if (dangerRe.test(text)) return "BLOCKED";

  // Navigation intent
  if (navRe.test(text)) return "NAVIGATE";

  // Action intent
  if (doAddRe.test(text) || doActionRe.test(text)) return "DO";

  // Health/nutrition questions
  if (proteinRe.test(text) || nutritionRe.test(text) || fitnessRe.test(text) || mindsetRe.test(text)) {
    return "QNA_HEALTH";
  }

  // Greetings and small talk
  if (/^(hi|hello|hey|thanks|thank you|bye|goodbye)$/i.test(text)) {
    return "SMALLTALK";
  }

  // Default to health Q&A for most queries
  return "QNA_HEALTH";
}

// Extract entities for add-to-shopping-list commands
export function parseAddToList(utterance: string) {
  const match = doAddRe.exec(utterance);
  if (!match) return null;

  const qtyUnit = (match[2] || "").trim(); // "2 lb" etc.
  const item = (match[4] || "").trim();

  let qty: number | undefined;
  let unit: string | undefined;

  if (qtyUnit) {
    const qtyMatch = /([\d\.]+)\s*(\w+)/.exec(qtyUnit);
    if (qtyMatch) {
      qty = parseFloat(qtyMatch[1]);
      unit = qtyMatch[2];
    }
  }

  return { item, qty, unit };
}

// Extract navigation targets - Enhanced FitBrain Rush detection
export function parseNavigation(prompt: string): string | null {
  const p = prompt.toLowerCase();
  if (/(open|show|go to|navigate).*(fitbrain|fit brain|brain game|rush)/i.test(p)) return "/fitbrain-rush";
  if (/(open|show|go to|navigate).*(planner|meal plan)/i.test(p)) return "/planner";
  if (/(open|show|go to|navigate).*(biometric|my biometric)/i.test(p)) return "/my-biometrics";
  if (/(open|show|go to|navigate).*(profile|settings)/i.test(p)) return "/profile";

  // Anti-Inflammatory help requests
  if (/(help|how|guide|info|tutorial).*(anti.*inflammatory|menu builder)/i.test(p)) return "help:anti-inflammatory";

  return null;
}