import { openai, chatJson } from '../utils/openaiSafe';
import { loadUserProtocolEnvelope, UserProtocolEnvelope } from './protocolEnvelope';
import { scanTextForHighRiskIngredients } from './ingredientIntelligence';

export interface HighRiskFlag {
  ingredientName: string;
  reason: string;
  riskByProtocol: Record<string, string>;
  failClosed: boolean;
}

export interface IngredientScanResult {
  alignmentGrade: 'A' | 'B' | 'C' | 'D';
  overallSummary: string;
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

TONE RULES (non-negotiable):
- Educational, calm, factual, personalized. NEVER fear-based, alarmist, or conspiratorial.
- Use language like "may not align with your [goal/condition]" — NEVER "toxic", "poison", "dangerous chemical", "harmful to everyone"
- Personalize everything: the same product may be appropriate for one user and not another
- If the user has no relevant conditions matching a concern, do not flag it
- This is general wellness education — NOT medical advice or diagnosis
- Do not mention specific medication names or make treatment claims
- If the ingredient list is benign for this user, say so positively

RESPONSE FORMAT (strict JSON only):
{
  "alignmentGrade": "A" | "B" | "C" | "D",
  "overallSummary": "1-2 sentence calm educational summary personalized to this user",
  "ingredientConsiderations": ["neutral factual observations about the ingredient list"],
  "mayNotAlignWith": ["personalized conflicts with user goals/conditions, or empty array"],
  "betterFor": ["contextual positives or appropriate use cases, or empty array"],
  "householdNotes": ["family/child-relevant observations if applicable, or empty array"],
  "educationalFooter": "brief non-diagnostic disclaimer"
}

Grade rubric:
A = aligns well with this user's profile
B = minor considerations, mostly fine for this user
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

const LOW_CONFIDENCE_RESULT: IngredientScanResult = {
  alignmentGrade: 'B',
  overallSummary:
    "We couldn't clearly read the ingredients from this image. Try retaking the photo in better lighting with the full ingredients panel visible and in focus.",
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
): Promise<IngredientScanResult> {
  const envelope = await loadUserProtocolEnvelope(userId);
  const protocolContext = envelope
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

    return {
      alignmentGrade: (['A', 'B', 'C', 'D'] as const).includes(alignment.alignmentGrade)
        ? alignment.alignmentGrade
        : 'B',
      overallSummary: typeof alignment.overallSummary === 'string' ? alignment.overallSummary : 'Analysis complete.',
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
