import { openai, chatJson } from '../utils/openaiSafe';
import { loadUserProtocolEnvelope, UserProtocolEnvelope } from './protocolEnvelope';
import { scanTextForHighRiskIngredients } from './ingredientIntelligence';

export interface HighRiskFlag {
  ingredientName: string;
  reason: string;
  riskByProtocol: Record<string, string>;
  failClosed: boolean;
}

export type ScoreVerdict = 'thumbsUp' | 'thumbsDown' | 'neutral';

export interface ScoreCard {
  verdict: ScoreVerdict;
  reason: string;
}

export interface ScanScoreCards {
  kids: ScoreCard;
  adults: ScoreCard;
  diet: ScoreCard;
  fitnessGoal: ScoreCard;
}

export type OutcomeVerdict = 'supports' | 'caution' | 'conflicts' | 'neutral';

export interface ProtocolOutcomeCard {
  protocolKey: string;
  label: string;
  verdict: OutcomeVerdict;
  reason: string;
}

export interface BetterAlternative {
  category: string;
  whyBetter: string[];
  targetCriteria: string;
}

export interface IngredientScanResult {
  alignmentGrade: 'A' | 'B' | 'C' | 'D';
  overallSummary: string;
  verdict: string;
  verdictLevel: 'buy' | 'caution' | 'skip';
  scoreCards: ScanScoreCards;
  outcomeCards: ProtocolOutcomeCard[];
  analysisProfile: string[];
  betterAlternatives: BetterAlternative[];
  ingredientDecoder: Array<{ name: string; plain: string; flag: 'ok' | 'watch' | 'avoid' }>;
  ingredientConsiderations: string[];
  mayNotAlignWith: string[];
  betterFor: string[];
  householdNotes: string[];
  educationalFooter: string;
  extractedIngredients: string[];
  highRiskFindings: HighRiskFlag[];
  ocrConfidenceLow: boolean;
  fallbackUsed: boolean;
  productName: string;
  isFrontLabel: boolean;
  analysisMethod: 'by_name' | 'by_label';
}

// ─── Analysis profile ────────────────────────────────────────────────────────
// Human-readable list of what data points were used in this scan. Shown in the
// UI so users understand why their result is personalised to them specifically.

function buildAnalysisProfile(envelope: UserProtocolEnvelope): string[] {
  const items: string[] = [];

  if (envelope.goalType === 'lose') items.push('Weight-loss goal');
  else if (envelope.goalType === 'gain') items.push('Muscle-gain goal');
  else if (envelope.goalType === 'maintain') items.push('Maintenance goal');

  if (envelope.hasDiabetes) {
    const diabetesText = [
      ...envelope.medicalHardLimits,
      ...envelope.conditionGuidanceBlocks,
    ].join(' ').toLowerCase();
    if (/type\s*1/.test(diabetesText)) items.push('Type 1 Diabetes');
    else if (/prediabetes/.test(diabetesText)) items.push('Prediabetes');
    else items.push('Type 2 Diabetes');
  }

  const allText = [
    ...envelope.medicalHardLimits,
    ...envelope.medicalOptimization,
    ...envelope.conditionGuidanceBlocks,
  ].join(' ').toLowerCase();

  if (/glp[-\s]?1|ozempic|wegovy|mounjaro|tirzepatide|semaglutide/.test(allText)) items.push('GLP-1 protocol');
  if (/hypertension|blood pressure/.test(allText)) items.push('Hypertension');
  if (/cardiac|heart disease/.test(allText)) items.push('Cardiac protocol');
  if (/renal|kidney/.test(allText)) items.push('Renal protocol');
  if (/anti.?inflam/.test(allText)) items.push('Anti-inflammatory protocol');
  if (/oncology|cancer/.test(allText)) items.push('Oncology protocol');

  if (envelope.thyroidSupport) {
    if (envelope.thyroidType === 'hypothyroid') items.push('Hypothyroid support');
    else if (envelope.thyroidType === 'hashimotos') items.push("Hashimoto's support");
    else if (envelope.thyroidType === 'hyperthyroid') items.push('Hyperthyroid support');
    else items.push('Thyroid support');
  }
  if (envelope.hormoneOptimization) items.push('Hormone optimization');

  for (const d of envelope.dietaryIdentity.slice(0, 2)) {
    const clean = d.replace(/_/g, ' ').toLowerCase();
    const label =
      clean === 'vegan'                   ? 'Vegan diet' :
      clean === 'vegetarian'              ? 'Vegetarian diet' :
      clean === 'keto' || clean === 'ketogenic' ? 'Keto diet' :
      clean === 'gluten-free' || clean === 'gluten free' ? 'Gluten-free' :
      clean === 'paleo'                   ? 'Paleo diet' :
      clean === 'halal'                   ? 'Halal' :
      clean === 'kosher'                  ? 'Kosher' :
      clean === 'low-fodmap' || clean === 'fodmap' ? 'Low-FODMAP' :
      d.charAt(0).toUpperCase() + d.slice(1);
    if (label) items.push(label);
  }

  if (envelope.diabeticGuidance) items.push('Recent blood glucose logs');

  return items;
}

// ─── Protocol card derivation ────────────────────────────────────────────────
// Inspects the live user envelope and returns the ordered list of protocol
// outcome cards the AI should assess. De-duplicates by key. Caps at 6.

interface CardSpec { protocolKey: string; label: string; }

function deriveProtocolCards(envelope: UserProtocolEnvelope | null): CardSpec[] {
  const cards: CardSpec[] = [];
  const seen = new Set<string>();

  const add = (key: string, label: string) => {
    if (!seen.has(key)) { seen.add(key); cards.push({ protocolKey: key, label }); }
  };

  if (!envelope) {
    return [
      { protocolKey: 'overall-nutrition',  label: 'Overall Nutrition' },
      { protocolKey: 'diet-compat',        label: 'Diet Compatibility' },
      { protocolKey: 'goal-alignment',     label: 'Goal Alignment' },
      { protocolKey: 'ingredient-quality', label: 'Ingredient Quality' },
    ];
  }

  const allText = [
    ...envelope.medicalHardLimits,
    ...envelope.medicalOptimization,
    ...envelope.conditionGuidanceBlocks,
  ].join(' ').toLowerCase();

  const hasGlp1        = /glp[-\s]?1|ozempic|wegovy|mounjaro|tirzepatide|semaglutide/.test(allText);
  const hasCardiac     = /cardiac|hypertension|blood pressure|heart disease/.test(allText);
  const hasRenal       = /renal|kidney/.test(allText);
  const hasAntiInflam  = /anti.?inflam|inflammation/.test(allText);
  const hasOncology    = /oncology|cancer/.test(allText);

  if (envelope.hasDiabetes) {
    add('blood-glucose',  'Blood Glucose Support');
    add('fiber',          'Fiber Support');
    add('protein',        'Protein Adequacy');
  }
  if (hasGlp1) {
    add('protein',    'Protein Adequacy');
    add('satiety',    'Satiety Support');
    add('digestive',  'Digestive Tolerance');
  }
  if (hasCardiac) {
    add('sodium',   'Sodium Control');
    add('heart',    'Heart Health Support');
    add('protein',  'Protein Adequacy');
  }
  if (hasRenal) {
    add('kidney',   'Kidney Support');
    add('sodium',   'Sodium Control');
    add('protein',  'Protein Adequacy');
  }
  if (hasAntiInflam) {
    add('inflammation',       'Inflammation Support');
    add('ingredient-quality', 'Ingredient Quality');
    add('protein',            'Protein Adequacy');
  }
  if (envelope.thyroidSupport) {
    add('thyroid',  'Thyroid Hormone Support');
    add('iodine',   'Iodine Balance');
    add('protein',  'Protein Adequacy');
  }
  if (envelope.hormoneOptimization) {
    add('hormone',            'Hormone Support');
    add('protein',            'Protein Adequacy');
    add('ingredient-quality', 'Ingredient Quality');
  }
  if (hasOncology) {
    add('ingredient-quality', 'Ingredient Quality');
    add('immune',             'Immune Support');
    add('protein',            'Protein Adequacy');
  }
  if (envelope.goalType === 'lose') {
    add('satiety',         'Satiety Support');
    add('caloric-balance', 'Caloric Balance');
    add('protein',         'Protein Adequacy');
  } else if (envelope.goalType === 'gain') {
    add('protein',          'Protein Adequacy');
    add('caloric-support',  'Caloric Support');
    add('recovery',         'Recovery Support');
  }

  const result = cards.slice(0, 6);

  if (result.length === 0) {
    return [
      { protocolKey: 'overall-nutrition',   label: 'Overall Nutrition' },
      { protocolKey: 'diet-compat',         label: 'Diet Compatibility' },
      { protocolKey: 'goal-alignment',      label: 'Goal Alignment' },
      { protocolKey: 'ingredient-quality',  label: 'Ingredient Quality' },
    ];
  }

  return result;
}

function buildCompactProtocolContext(envelope: UserProtocolEnvelope): string {
  const lines: string[] = [];

  if (envelope.goalType || envelope.fitnessGoal) {
    const goalParts: string[] = [];
    if (envelope.goalType) {
      const goalLabel =
        envelope.goalType === 'lose' ? 'weight loss'
        : envelope.goalType === 'gain' ? 'muscle/weight gain'
        : 'weight maintenance';
      goalParts.push(goalLabel);
    }
    if (envelope.fitnessGoal && envelope.fitnessGoal !== envelope.goalType) {
      goalParts.push(envelope.fitnessGoal.replace(/_/g, ' '));
    }
    if (envelope.goalTarget) goalParts.push(`target: ${envelope.goalTarget}`);
    lines.push(`Primary nutrition goal: ${goalParts.join(', ')}`);
  }

  if (envelope.dietaryIdentity.length)
    lines.push(`Dietary identity: ${envelope.dietaryIdentity.join(', ')}`);
  if (envelope.allergies.length)
    lines.push(`Allergies (hard stops): ${envelope.allergies.join(', ')}`);
  if (envelope.medicalHardLimits.length)
    lines.push(`Medical hard limits: ${envelope.medicalHardLimits.join(', ')}`);
  if (envelope.medicalOptimization.length)
    lines.push(`Medical optimization goals: ${envelope.medicalOptimization.join(', ')}`);
  if (envelope.conditionGuidanceBlocks.length)
    lines.push(`Active health conditions: ${envelope.conditionGuidanceBlocks.join(' | ')}`);
  if (envelope.hasDiabetes) {
    lines.push('Has diabetes: yes');
    if (envelope.diabeticGuidance)
      lines.push(`Glucose guidance context: ${envelope.diabeticGuidance}`);
  }
  if (envelope.thyroidSupport)
    lines.push('Thyroid support protocol: active');
  if (envelope.avoidances.length)
    lines.push(`Avoidances/preferences: ${envelope.avoidances.join(', ')}`);

  return lines.length ? lines.join('\n') : 'No specific dietary or medical constraints on file.';
}

const COMPANION_ALIGNMENT_SYSTEM_PROMPT = `You are a companion pet wellness advisor for a nutrition app called MyPerfectMeals.
A dog owner is standing in a store aisle and wants to know: "Can my dog eat this?"

Your job is to give a clear, honest, direct answer — personalized to the specific dog's profile.

CORE PURPOSE:
Answer one question: is this product a good fit for this dog, given their breed, age, weight, known sensitivities, allergies, medications, and wellness goals?
The owner needs to make a decision in under 30 seconds. Make it easy for them.

TONE RULES (non-negotiable):
- Warm, direct, and practical. Like a knowledgeable dog-owner friend, not a vet report.
- Use plain everyday language — no jargon.
- Personalize everything: reference the dog's name and specific profile details.
- If the product is genuinely fine for this dog, say so clearly.
- NEVER use alarmist language like "toxic", "dangerous", "harmful" — use "may not align with [Dog]'s profile" or "may increase discomfort."
- This is general wellness education — NOT veterinary advice or diagnosis.

RESPONSE FORMAT (strict JSON only):
{
  "alignmentGrade": "A" | "B" | "C" | "D",
  "overallSummary": "2-4 sentences. State clearly whether this product is appropriate for this specific dog and why. Reference the dog's name, their key sensitivities or goals, and the specific ingredients of concern (if any). Write like a trusted advisor giving a friend honest advice in a store aisle.",
  "verdict": "One sentence summary of the recommendation.",
  "verdictLevel": "buy" | "caution" | "skip",
  "scoreCards": {
    "kids": { "verdict": "neutral", "reason": "Not applicable — companion scan." },
    "adults": { "verdict": "neutral", "reason": "Not applicable — companion scan." },
    "diet": { "verdict": "neutral", "reason": "Not applicable — companion scan." },
    "fitnessGoal": { "verdict": "neutral", "reason": "Not applicable — companion scan." }
  },
  "outcomeCards": [],
  "betterAlternatives": [],
  "ingredientDecoder": [],
  "ingredientConsiderations": [],
  "mayNotAlignWith": ["List the specific active profile considerations that conflict with this product — e.g. 'Chicken Sensitivity', 'Senior Wellness', 'Healthy Weight Support'. Use short label-style strings (3-4 words max). Empty array if none conflict."],
  "betterFor": ["Concrete alternative suggestions relevant to this dog's needs — e.g. 'Chicken-free formulas', 'Turkey-based options', 'Fish-based recipes for sensitive stomachs'. 2-4 suggestions if verdictLevel is caution or skip. Empty array if buy."],
  "householdNotes": [],
  "educationalFooter": "Companion wellness guidance only — not veterinary advice."
}

verdictLevel:
- "buy" = this product aligns well with this specific dog's profile — owner can feel confident
- "caution" = some considerations worth knowing, but not a hard stop — owner should be aware
- "skip" = notable conflicts with this dog's documented profile — recommend looking for alternatives

Grade rubric:
A = aligns well with this dog's profile
B = mostly fine, minor considerations
C = some concerns worth discussing with vet
D = notable conflicts with documented sensitivities or goals

CRITICAL RULES:
- scoreCards are always stub/neutral for companion scans — do NOT analyze for human categories
- outcomeCards is always an empty array for companion scans
- The overallSummary is the most important field — invest effort here
- mayNotAlignWith should be short label strings (not sentences) — they become chips in the UI
- betterFor should be actionable and specific to this dog's situation
- If the product is clearly fine, say so warmly and confidently`;

const ALIGNMENT_SYSTEM_PROMPT = `You are a personalized food intelligence advisor for a nutrition app called MyPerfectMeals.
Analyze a food product's ingredient list and provide a calibrated, educational alignment assessment based on the user's specific health profile.

CORE PURPOSE:
Most people cannot understand complex chemical ingredient names. Your job is to (1) decode those names into plain everyday English, (2) tell the user whether this product aligns with their personal health goals and medical needs, and (3) give them a clear, personalized verdict so they can decide whether to buy it.

TONE RULES (non-negotiable):
- Educational, calm, factual, personalized. NEVER fear-based, alarmist, or conspiratorial.
- Use plain everyday language — write like a knowledgeable friend, not a scientist.
- Use language like "may not align with your [goal/condition]" — NEVER "toxic", "poison", "dangerous chemical", "harmful to everyone"
- Personalize everything: the same product may be appropriate for one user and not another
- If the user has no relevant conditions matching a concern, do not flag it
- This is general wellness education — NOT medical advice or diagnosis
- Do not mention specific medication names or make treatment claims
- If the ingredient list is benign for this user, say so positively

RESPONSE FORMAT (strict JSON only):
{
  "alignmentGrade": "A" | "B" | "C" | "D",
  "overallSummary": "1-2 sentence plain-language summary personalized to this user and their goals. Friendly coach tone.",
  "verdict": "One clear, direct sentence — should this user buy this product? Be warm and personal, like a friend giving advice.",
  "verdictLevel": "buy" | "caution" | "skip",
  "scoreCards": {
    "kids": { "verdict": "neutral", "reason": "" },
    "adults": { "verdict": "neutral", "reason": "" },
    "diet": { "verdict": "neutral", "reason": "" },
    "fitnessGoal": { "verdict": "neutral", "reason": "" }
  },
  "outcomeCards": [
    {
      "protocolKey": "exact key from the PROTOCOL CARDS list",
      "label": "exact label from the PROTOCOL CARDS list",
      "verdict": "supports" | "caution" | "conflicts" | "neutral",
      "reason": "One plain English sentence: how does this product impact this specific outcome goal for this user? Reference a specific ingredient or nutrient."
    }
  ],
  "ingredientDecoder": [
    {
      "name": "Exact ingredient name as it appears on the label",
      "plain": "Plain English: what is this ingredient and what does it do in food? 1 simple sentence anyone can understand.",
      "flag": "ok" | "watch" | "avoid"
    }
  ],
  "ingredientConsiderations": ["Factual observations about specific ingredients relevant to this user's health profile"],
  "mayNotAlignWith": ["Personalized conflicts with this user's goals/conditions — only if genuinely relevant. Empty array if none."],
  "betterFor": ["Contextual positives or appropriate use cases — or empty array"],
  "betterAlternatives": [
    {
      "category": "Look for a [product type] with [key property]",
      "whyBetter": ["Specific advantage vs. this product, e.g. '12g+ protein per serving'", "Second advantage tied to user's protocol"],
      "targetCriteria": "Aim for [specific thresholds] per serving when shopping"
    }
  ],
  "householdNotes": ["Any additional household member notes — or empty array"],
  "educationalFooter": "Brief friendly non-diagnostic note"
}

betterAlternatives rules:
- Only populate when verdictLevel is "caution" or "skip" — return empty array when "buy"
- Return 1–3 generic product category alternatives ONLY — NEVER name specific brands, products, or retailers
- Frame each as what type of product to look for (e.g. "Look for a chickpea or legume-based pasta") not what to buy
- whyBetter: 2–4 short phrases citing specific nutritional advantages vs. this product; reference the user's active protocols directly (e.g. "Lower glycemic load supports blood glucose goals")
- targetCriteria: one actionable sentence with concrete thresholds the user can use while reading labels (e.g. "Aim for 10g+ protein, 5g+ fiber, under 35g net carbs per serving")
- Tie alternatives directly to the specific protocol conflicts identified — not generic "healthier" advice

outcomeCards rules:
- A PROTOCOL CARDS TO ASSESS list is provided in the user message
- Return one entry for EVERY card in that list — use the exact protocolKey and label provided, in the same order
- verdict: "supports" = product meaningfully helps this goal, "caution" = mixed signal or partial concern, "conflicts" = product works against this goal, "neutral" = no meaningful signal either way
- Base verdicts strictly on the actual ingredient and nutritional content vs. the user's specific health conditions — not generic food quality judgments
- Keep reasons short, direct, and specific: reference actual ingredients or nutrients where possible (e.g. "The 28g added sugar directly conflicts with blood glucose control." or "18g protein per serving strongly supports your GLP-1 protein goal.")
- If a card has no relevant information to assess, return "neutral" with a brief note

scoreCards: fill in all 4 with real verdicts and reasons based on the ingredient list — these are the visible explanation cards for kids, adults, diet compatibility, and the user's fitness goal. Do not return neutral stubs; give genuine assessments with a short reason for each.

ingredientDecoder rules:
- Decode ALL chemical-sounding, unfamiliar, or hard-to-pronounce ingredients (e.g., Red 40, TBHQ, carrageenan, sodium benzoate, BHA, BHT, MSG, xanthan gum, maltodextrin, etc.)
- Skip simple common ingredients everyone already knows (salt, water, sugar, flour, butter, eggs, milk)
- flag: "ok" = generally recognized safe, "watch" = worth knowing about, "avoid" = conflicts with this user's specific profile
- Aim for 3–8 decoded ingredients. Empty array if the list is clean.

verdictLevel:
- "buy" = overall aligns well with this user
- "caution" = some considerations but not a deal-breaker
- "skip" = notable conflicts with this user's active health protocols

Grade rubric:
A = aligns well with this user's profile
B = minor considerations, mostly fine
C = notable considerations for this user's specific goals
D = significant conflicts with this user's active health protocols`;

async function extractIngredients(imageDataUrl: string): Promise<{
  text: string;
  confidence: 'high' | 'medium' | 'low';
  found: boolean;
  productName: string;
  isFrontLabel: boolean;
}> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a precise food label reader. Your job is to:
1. Extract the ingredients list if it is visible on this image
2. Identify the product name and brand if visible anywhere on the label
3. Detect whether this is the front/decorative label vs the back/side panel that contains the ingredients list

Return ONLY valid JSON:
{
  "ingredients_text": "exact ingredients panel text as printed, or empty string if not visible",
  "confidence": "high" | "medium" | "low",
  "found_ingredients_panel": true | false,
  "product_name": "Brand + Product name as printed, e.g. 'Ragú Old World Style Traditional Sauce' — empty string if not readable",
  "is_front_label": true | false
}

is_front_label: true when this is clearly the front/decorative face of the product (large logo, product photo, marketing text) and the ingredients panel is NOT visible.
is_front_label: false when this IS the ingredients/nutrition panel or when it genuinely cannot be determined.

Do NOT invent or guess ingredients. If the ingredients text is partially obscured, set confidence to "low".`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this food product label image.' },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
        ],
      },
    ],
    max_tokens: 700,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

  return {
    text: typeof parsed.ingredients_text === 'string' ? parsed.ingredients_text : '',
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    found: parsed.found_ingredients_panel !== false,
    productName: typeof parsed.product_name === 'string' ? parsed.product_name.trim() : '',
    isFrontLabel: parsed.is_front_label === true,
  };
}

const DEFAULT_SCORE_CARDS: ScanScoreCards = {
  kids: { verdict: 'neutral', reason: '' },
  adults: { verdict: 'neutral', reason: '' },
  diet: { verdict: 'neutral', reason: '' },
  fitnessGoal: { verdict: 'neutral', reason: '' },
};

function parseScoreCards(raw: any): ScanScoreCards {
  const verdicts: ScoreVerdict[] = ['thumbsUp', 'thumbsDown', 'neutral'];
  const parseCard = (card: any): ScoreCard => ({
    verdict: verdicts.includes(card?.verdict) ? card.verdict : 'neutral',
    reason: typeof card?.reason === 'string' ? card.reason : '',
  });
  return {
    kids: parseCard(raw?.kids),
    adults: parseCard(raw?.adults),
    diet: parseCard(raw?.diet),
    fitnessGoal: parseCard(raw?.fitnessGoal),
  };
}

function parseBetterAlternatives(raw: any): BetterAlternative[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .filter((a: any) => a && typeof a.category === 'string')
    .slice(0, 3)
    .map((a: any) => ({
      category: a.category as string,
      whyBetter: Array.isArray(a.whyBetter) ? a.whyBetter.filter((w: any) => typeof w === 'string') : [],
      targetCriteria: typeof a.targetCriteria === 'string' ? a.targetCriteria : '',
    }));
}

function parseOutcomeCards(raw: any, _expected: CardSpec[]): ProtocolOutcomeCard[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const validVerdicts: OutcomeVerdict[] = ['supports', 'caution', 'conflicts', 'neutral'];
  return raw
    .filter((c: any) => c && typeof c.protocolKey === 'string' && typeof c.label === 'string')
    .map((c: any) => ({
      protocolKey: c.protocolKey as string,
      label: c.label as string,
      verdict: validVerdicts.includes(c.verdict) ? (c.verdict as OutcomeVerdict) : 'neutral',
      reason: typeof c.reason === 'string' ? c.reason : '',
    }));
}

const LOW_CONFIDENCE_RESULT: IngredientScanResult = {
  alignmentGrade: 'B',
  overallSummary:
    "We couldn't clearly read the ingredients from this image. Try retaking the photo in better lighting with the full ingredients panel visible and in focus.",
  verdict: "Try retaking the photo so we can give you a personalized assessment.",
  verdictLevel: 'caution',
  scoreCards: DEFAULT_SCORE_CARDS,
  outcomeCards: [],
  analysisProfile: [],
  betterAlternatives: [],
  ingredientDecoder: [],
  ingredientConsiderations: [],
  mayNotAlignWith: [],
  betterFor: [],
  householdNotes: [],
  educationalFooter:
    'Ingredient Intelligence provides general wellness education and is not a substitute for medical advice.',
  extractedIngredients: [],
  highRiskFindings: [],
  ocrConfidenceLow: true,
  fallbackUsed: false,
  productName: '',
  isFrontLabel: false,
  analysisMethod: 'by_label',
};

function makeFrontLabelResult(productName: string): IngredientScanResult {
  const name = productName || 'this product';
  return {
    alignmentGrade: 'B',
    overallSummary: `That's the front label of ${name}. The ingredients panel is on the back or side of the package — flip it over and scan that panel for a full personalized analysis.`,
    verdict: `Flip to the back or side of the package to scan the ingredients list.`,
    verdictLevel: 'caution',
    scoreCards: DEFAULT_SCORE_CARDS,
    outcomeCards: [],
    analysisProfile: [],
    betterAlternatives: [],
    ingredientDecoder: [],
    ingredientConsiderations: [],
    mayNotAlignWith: [],
    betterFor: [],
    householdNotes: [],
    educationalFooter:
      'Ingredient Intelligence provides general wellness education and is not a substitute for medical advice.',
    extractedIngredients: [],
    highRiskFindings: [],
    ocrConfidenceLow: false,
    fallbackUsed: false,
    productName,
    isFrontLabel: true,
    analysisMethod: 'by_label',
  };
}

// ─── BY-NAME ANALYSIS SYSTEM PROMPT ──────────────────────────────────────────
// Used when the user scans the front label and taps "Analyze This Product."
// Explicitly allows named brand alternatives. Always includes an accuracy note.

const BY_NAME_SYSTEM_PROMPT = `You are a personalized nutrition coach integrated into the MyPerfectMeals app. A user has photographed the front label of a packaged food product and identified the product name. You will analyze this product using your training knowledge and give a personalized recommendation based on the user's health profile.

CRITICAL GUARDRAILS:
- You are using trained knowledge of this product, NOT a verified live nutrition database.
- Product formulas and nutrition facts change over time. Never state that you have confirmed the exact current nutritional content.
- Your analysis is a likely assessment — not a verified label scan.
- You MUST name specific real branded alternatives (Rao's, Amy's, etc.) — that is the core value of this analysis path.

RESPONSE FORMAT (strict JSON only):
{
  "alignmentGrade": "A" | "B" | "C" | "D",
  "overallSummary": "1–2 sentence summary analyzing this product for this specific user. Acknowledge you're working from product knowledge. Friendly coach tone, e.g. 'Based on what I know about [product], here's how it looks for your [condition/goal]...'",
  "verdict": "One clear actionable sentence — should this user keep buying it, use it in moderation, or find something better?",
  "verdictLevel": "buy" | "caution" | "skip",
  "scoreCards": {
    "kids":        { "verdict": "thumbsUp" | "thumbsDown" | "neutral", "reason": "one short plain-English sentence" },
    "adults":      { "verdict": "thumbsUp" | "thumbsDown" | "neutral", "reason": "one short plain-English sentence" },
    "diet":        { "verdict": "thumbsUp" | "thumbsDown" | "neutral", "reason": "one short plain-English sentence" },
    "fitnessGoal": { "verdict": "thumbsUp" | "thumbsDown" | "neutral", "reason": "one short plain-English sentence" }
  },
  "outcomeCards": [],
  "ingredientDecoder": [],
  "ingredientConsiderations": ["Key nutrients or ingredients in this product relevant to this user's health profile — cite specific values if you know them, e.g. '480mg sodium per serving'"],
  "mayNotAlignWith": ["Specific concerns for this user's active protocols — only if genuinely relevant. Empty if the product fits well."],
  "betterFor": ["Contextual positives or good-fit use cases for this product"],
  "betterAlternatives": [
    {
      "category": "Specific real product name, e.g. 'Rao\\'s Homemade Marinara' or 'Amy\\'s Light in Sodium Lentil Soup'",
      "whyBetter": ["One specific advantage vs. the scanned product tied to user protocol — e.g. '60% less sodium, better for cardiac care'", "Second specific advantage"],
      "targetCriteria": "Where to find it — major grocery chains, Walmart, Target, Costco, etc."
    }
  ],
  "householdNotes": [],
  "educationalFooter": "Based on product knowledge, not a verified label scan. Product formulas can change — scan the ingredients or nutrition facts panel for the most accurate analysis."
}

betterAlternatives rules:
- NAME 3–4 SPECIFIC REAL BRANDS AND PRODUCTS — this is the core value of this feature path.
- Only products widely available at major US grocery retailers.
- Only populate when verdictLevel is "caution" or "skip" — return empty array for "buy".
- Each alternative must be tied directly to what the user's health protocol actually needs.
- Do not return generic categories here — use actual product names (e.g. "Barilla Protein+ Spaghetti" not "high-protein pasta").

scoreCards: give real assessments based on your knowledge of this product's typical ingredients and nutrition. Do not return all-neutral stubs.

ingredientConsiderations: use this to flag the most relevant known nutritional facts (sodium, sugar, saturated fat, fiber, protein, additives) as they relate to this specific user's profile.

verdictLevel:
- "buy" = overall aligns with this user's profile
- "caution" = some concerns but not a dealbreaker for this user
- "skip" = notable conflicts with this user's active health protocols

Grade rubric:
A = aligns well with this user's profile
B = minor considerations, mostly fine for this user
C = notable considerations for this user's specific protocols
D = significant conflicts with this user's active health protocols`;

export async function analyzeIngredientContent(
  userId: string,
  input: { imageDataUrl?: string; rawText?: string },
  companionContext?: string,
): Promise<IngredientScanResult> {
  const isCompanionScan = !!companionContext;
  const envelope = isCompanionScan ? null : await loadUserProtocolEnvelope(userId);
  const protocolContext = isCompanionScan
    ? companionContext!
    : envelope
    ? buildCompactProtocolContext(envelope)
    : 'No specific dietary or medical constraints on file.';
  const dietaryProtocols = envelope
    ? envelope.dietaryIdentity.map((d) => d.toLowerCase())
    : [];

  const cardRequests: CardSpec[] = !isCompanionScan
    ? deriveProtocolCards(envelope)
    : [];

  const analysisProfile: string[] = (!isCompanionScan && envelope)
    ? buildAnalysisProfile(envelope)
    : [];

  let extractedText = '';
  let ocrConfidenceLow = false;
  let detectedProductName = '';

  if (input.rawText?.trim()) {
    extractedText = input.rawText.trim();
  } else if (input.imageDataUrl) {
    try {
      const ocr = await extractIngredients(input.imageDataUrl);
      detectedProductName = ocr.productName;
      if (!ocr.found || !ocr.text.trim()) {
        // Front label detected — give actionable "flip to back" message
        if (ocr.isFrontLabel) {
          return makeFrontLabelResult(ocr.productName);
        }
        return { ...LOW_CONFIDENCE_RESULT };
      }
      extractedText = ocr.text;
      if (ocr.confidence === 'low') ocrConfidenceLow = true;
    } catch {
      return { ...LOW_CONFIDENCE_RESULT, fallbackUsed: true };
    }
  } else {
    return { ...LOW_CONFIDENCE_RESULT, fallbackUsed: true };
  }

  const lookupResults = scanTextForHighRiskIngredients(extractedText, dietaryProtocols);
  const highRiskFindings: HighRiskFlag[] = lookupResults.map((r) => ({
    ingredientName: r.ingredientName,
    reason: r.reason,
    riskByProtocol: r.riskByProtocol as Record<string, string>,
    failClosed: r.failClosed,
  }));

  const extractedIngredients = extractedText
    .split(/[,;]/)
    .map((i) => i.trim())
    .filter(Boolean)
    .slice(0, 40);

  const highRiskContext =
    highRiskFindings.length > 0
      ? `\nKnown high-risk findings: ${highRiskFindings.map((f) => `${f.ingredientName} (${f.reason})`).join('; ')}`
      : '';

  const cardListText = cardRequests.length > 0
    ? `\nPROTOCOL CARDS TO ASSESS:\n${cardRequests.map(c => `${c.protocolKey}: ${c.label}`).join('\n')}\n\nReturn one outcomeCard entry for each card above using the exact protocolKey and label.`
    : '\nPROTOCOL CARDS TO ASSESS: none (return empty outcomeCards array)';

  const productNameLine = detectedProductName
    ? `PRODUCT NAME: ${detectedProductName}\n`
    : '';

  const userMessage = `USER HEALTH PROFILE:
${protocolContext}
${cardListText}

${productNameLine}PRODUCT INGREDIENT LIST:
${extractedText}
${highRiskContext}

Analyze how this product aligns with this specific user's health profile.`;

  try {
    const alignment = await chatJson({
      system: isCompanionScan ? COMPANION_ALIGNMENT_SYSTEM_PROMPT : ALIGNMENT_SYSTEM_PROMPT,
      user: userMessage,
      temperature: 0.2,
    });

    const rawDecoder = Array.isArray(alignment.ingredientDecoder) ? alignment.ingredientDecoder : [];
    const ingredientDecoder = rawDecoder
      .filter((d: any) => d && typeof d.name === 'string' && typeof d.plain === 'string')
      .map((d: any) => ({
        name: d.name as string,
        plain: d.plain as string,
        flag: (['ok', 'watch', 'avoid'] as const).includes(d.flag) ? d.flag : 'watch' as const,
      }));

    return {
      alignmentGrade: (['A', 'B', 'C', 'D'] as const).includes(alignment.alignmentGrade)
        ? alignment.alignmentGrade
        : 'B',
      overallSummary: typeof alignment.overallSummary === 'string' ? alignment.overallSummary : 'Analysis complete.',
      verdict: typeof alignment.verdict === 'string' ? alignment.verdict : '',
      verdictLevel: (['buy', 'caution', 'skip'] as const).includes(alignment.verdictLevel)
        ? alignment.verdictLevel
        : 'caution',
      scoreCards: parseScoreCards(alignment.scoreCards),
      outcomeCards: parseOutcomeCards(alignment.outcomeCards, cardRequests),
      analysisProfile,
      betterAlternatives: parseBetterAlternatives(alignment.betterAlternatives),
      ingredientDecoder,
      ingredientConsiderations: Array.isArray(alignment.ingredientConsiderations)
        ? alignment.ingredientConsiderations
        : [],
      mayNotAlignWith: Array.isArray(alignment.mayNotAlignWith) ? alignment.mayNotAlignWith : [],
      betterFor: Array.isArray(alignment.betterFor) ? alignment.betterFor : [],
      householdNotes: Array.isArray(alignment.householdNotes) ? alignment.householdNotes : [],
      educationalFooter:
        typeof alignment.educationalFooter === 'string'
          ? alignment.educationalFooter
          : 'This analysis is for general wellness education and is not medical advice.',
      extractedIngredients,
      highRiskFindings,
      ocrConfidenceLow,
      fallbackUsed: false,
      productName: detectedProductName,
      isFrontLabel: false,
      analysisMethod: 'by_label',
    };
  } catch {
    return {
      alignmentGrade: 'B',
      overallSummary: 'We encountered an issue analyzing this product. Please try again.',
      verdict: '',
      verdictLevel: 'caution',
      scoreCards: DEFAULT_SCORE_CARDS,
      outcomeCards: [],
      analysisProfile,
      betterAlternatives: [],
      ingredientDecoder: [],
      ingredientConsiderations: [],
      mayNotAlignWith: [],
      betterFor: [],
      householdNotes: [],
      educationalFooter:
        'Ingredient Intelligence provides general wellness education and is not medical advice.',
      extractedIngredients,
      highRiskFindings,
      ocrConfidenceLow,
      fallbackUsed: true,
      productName: detectedProductName,
      isFrontLabel: false,
      analysisMethod: 'by_label',
    };
  }
}

// ─── ANALYZE BY PRODUCT NAME ──────────────────────────────────────────────────
// Called when user taps "Analyze This Product" after front-label detection.
// Uses AI's training knowledge of the product — not a live label scan.

export async function analyzeProductByName(
  productName: string,
  userId: string,
): Promise<IngredientScanResult> {
  const envelope = await loadUserProtocolEnvelope(userId);
  const protocolContext = envelope
    ? buildCompactProtocolContext(envelope)
    : 'No specific dietary or medical constraints on file.';
  const analysisProfile: string[] = envelope ? buildAnalysisProfile(envelope) : [];

  const userMessage = `USER HEALTH PROFILE:
${protocolContext}

PRODUCT TO ANALYZE: ${productName}

Using your knowledge of this specific product, analyze how well it aligns with this user's health profile. Name specific real branded alternatives if the product has notable concerns for this user.`;

  try {
    const alignment = await chatJson({
      system: BY_NAME_SYSTEM_PROMPT,
      user: userMessage,
      temperature: 0.3,
    });

    const rawDecoder = Array.isArray(alignment.ingredientDecoder) ? alignment.ingredientDecoder : [];
    const ingredientDecoder = rawDecoder
      .filter((d: any) => d && typeof d.name === 'string' && typeof d.plain === 'string')
      .map((d: any) => ({
        name: d.name as string,
        plain: d.plain as string,
        flag: (['ok', 'watch', 'avoid'] as const).includes(d.flag) ? d.flag : 'watch' as const,
      }));

    const rawAlts = Array.isArray(alignment.betterAlternatives) ? alignment.betterAlternatives : [];
    const betterAlternatives: BetterAlternative[] = rawAlts.map((a: any) => ({
      category: typeof a.category === 'string' ? a.category : '',
      whyBetter: Array.isArray(a.whyBetter) ? a.whyBetter.filter((w: any) => typeof w === 'string') : [],
      targetCriteria: typeof a.targetCriteria === 'string' ? a.targetCriteria : '',
    })).filter((a: BetterAlternative) => a.category);

    return {
      alignmentGrade: (['A', 'B', 'C', 'D'] as const).includes(alignment.alignmentGrade) ? alignment.alignmentGrade : 'B',
      overallSummary: typeof alignment.overallSummary === 'string' ? alignment.overallSummary : 'Analysis complete.',
      verdict: typeof alignment.verdict === 'string' ? alignment.verdict : '',
      verdictLevel: (['buy', 'caution', 'skip'] as const).includes(alignment.verdictLevel) ? alignment.verdictLevel : 'caution',
      scoreCards: parseScoreCards(alignment.scoreCards),
      outcomeCards: [],
      analysisProfile,
      betterAlternatives,
      ingredientDecoder,
      ingredientConsiderations: Array.isArray(alignment.ingredientConsiderations) ? alignment.ingredientConsiderations.filter((s: any) => typeof s === 'string') : [],
      mayNotAlignWith: Array.isArray(alignment.mayNotAlignWith) ? alignment.mayNotAlignWith.filter((s: any) => typeof s === 'string') : [],
      betterFor: Array.isArray(alignment.betterFor) ? alignment.betterFor.filter((s: any) => typeof s === 'string') : [],
      householdNotes: Array.isArray(alignment.householdNotes) ? alignment.householdNotes.filter((s: any) => typeof s === 'string') : [],
      educationalFooter: typeof alignment.educationalFooter === 'string'
        ? alignment.educationalFooter
        : 'Based on product knowledge, not a verified label scan. Product formulas can change.',
      extractedIngredients: [],
      highRiskFindings: [],
      ocrConfidenceLow: false,
      fallbackUsed: false,
      productName,
      isFrontLabel: false,
      analysisMethod: 'by_name',
    };
  } catch {
    return {
      ...LOW_CONFIDENCE_RESULT,
      overallSummary: 'We encountered an issue analyzing this product by name. Please try again or scan the ingredients panel.',
      productName,
      analysisMethod: 'by_name',
      fallbackUsed: true,
    };
  }
}
