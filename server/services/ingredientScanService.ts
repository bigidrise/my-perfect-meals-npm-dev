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

export interface IngredientScanResult {
  alignmentGrade: 'A' | 'B' | 'C' | 'D';
  overallSummary: string;
  verdict: string;
  verdictLevel: 'buy' | 'caution' | 'skip';
  scoreCards: ScanScoreCards;
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
}

function buildCompactProtocolContext(envelope: UserProtocolEnvelope): string {
  const lines: string[] = [];

  // ── Fitness goals (set during onboarding) ────────────────────────────────
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
    "kids": {
      "verdict": "thumbsUp" | "thumbsDown" | "neutral",
      "reason": "One plain-English sentence about why this is or isn't good for kids. Always check for: artificial dyes (Red 40, Yellow 5, etc.), high sugar, caffeine, artificial sweeteners, preservatives."
    },
    "adults": {
      "verdict": "thumbsUp" | "thumbsDown" | "neutral",
      "reason": "One plain-English sentence about general adult suitability — common allergens, sodium, saturated fat, additives."
    },
    "diet": {
      "verdict": "thumbsUp" | "thumbsDown" | "neutral",
      "reason": "One sentence about how this fits the user's dietary identity (vegan, keto, gluten-free, etc.). If no dietary restrictions are on file, give general nutrition quality feedback."
    },
    "fitnessGoal": {
      "verdict": "thumbsUp" | "thumbsDown" | "neutral",
      "reason": "One sentence connecting this product to the user's fitness/weight goal (weight loss, muscle gain, maintenance). If no goal is on file, give general comment on macros."
    }
  },
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
  "householdNotes": ["Any additional household member notes beyond the kids scorecard — or empty array"],
  "educationalFooter": "Brief friendly non-diagnostic note"
}

scoreCards rules:
- ALWAYS return all 4 scoreCards — never omit any
- neutral = it's fine, no strong signals either way
- thumbsUp = genuinely good signal for this category
- thumbsDown = notable concern for this category
- Keep reasons short, friendly, and coach-like — not scary

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
}> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a precise food label reader. Extract the ingredients list exactly as printed on the product label.
Return ONLY valid JSON:
{
  "ingredients_text": "exact ingredients panel text as printed",
  "confidence": "high" | "medium" | "low",
  "found_ingredients_panel": true | false
}
If no ingredients panel is visible, return found_ingredients_panel: false with empty ingredients_text.
Do NOT invent or guess ingredients. If text is partially obscured, set confidence to "low".`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the ingredients list from this food product label.' },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
        ],
      },
    ],
    max_tokens: 600,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

  return {
    text: typeof parsed.ingredients_text === 'string' ? parsed.ingredients_text : '',
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    found: parsed.found_ingredients_panel !== false,
  };
}

const DEFAULT_SCORE_CARDS: ScanScoreCards = {
  kids: { verdict: 'neutral', reason: 'No specific child concerns detected.' },
  adults: { verdict: 'neutral', reason: 'No major adult concerns detected.' },
  diet: { verdict: 'neutral', reason: 'No dietary conflicts identified.' },
  fitnessGoal: { verdict: 'neutral', reason: 'No strong signals relative to your goal.' },
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

const LOW_CONFIDENCE_RESULT: IngredientScanResult = {
  alignmentGrade: 'B',
  overallSummary:
    "We couldn't clearly read the ingredients from this image. Try retaking the photo in better lighting with the full ingredients panel visible and in focus.",
  verdict: "Try retaking the photo so we can give you a personalized assessment.",
  verdictLevel: 'caution',
  scoreCards: DEFAULT_SCORE_CARDS,
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
};

export async function analyzeIngredientPhoto(
  userId: string,
  imageDataUrl: string,
  companionContext?: string,
): Promise<IngredientScanResult> {
  // When scanning for a companion (dog), use dog profile context instead of human protocol
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

  let extractedText = '';
  let ocrConfidenceLow = false;

  try {
    const ocr = await extractIngredients(imageDataUrl);
    if (!ocr.found || !ocr.text.trim()) {
      return { ...LOW_CONFIDENCE_RESULT };
    }
    extractedText = ocr.text;
    if (ocr.confidence === 'low') ocrConfidenceLow = true;
  } catch {
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

  const userMessage = `USER HEALTH PROFILE:
${protocolContext}

PRODUCT INGREDIENT LIST:
${extractedText}
${highRiskContext}

Analyze how this product aligns with this specific user's health profile.`;

  try {
    const alignment = await chatJson({
      system: ALIGNMENT_SYSTEM_PROMPT,
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
    };
  } catch {
    return {
      alignmentGrade: 'B',
      overallSummary: 'We encountered an issue analyzing this product. Please try again.',
      verdict: '',
      verdictLevel: 'caution',
      scoreCards: DEFAULT_SCORE_CARDS,
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
    };
  }
}
