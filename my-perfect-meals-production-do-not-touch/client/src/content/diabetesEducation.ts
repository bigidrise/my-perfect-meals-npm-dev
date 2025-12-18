/**
 * Diabetic Hub Educational Content & Clinical References
 * 
 * Centralized content for diabetes-related features including:
 * - Blood glucose thresholds and ranges
 * - Carbohydrate intake guidelines
 * - Educational content with clinical citations
 * - Advisory messages for users
 */

// ========================================
// Blood Glucose Thresholds (mg/dL)
// ========================================

export const GLUCOSE_THRESHOLDS = {
  LOW: 70,
  PRE_MEAL_MIN: 80,
  PRE_MEAL_MAX: 130,
  POST_MEAL_TARGET: 180,
  HIGH: 180,
} as const;

export type GlucoseLevel = 'low' | 'in-target' | 'high';

/**
 * Classify a glucose reading into clinical categories
 * Defaults to pre-meal context when no context is specified
 */
export function classifyGlucose(mgdl: number, context: 'pre-meal' | 'post-meal' = 'pre-meal'): GlucoseLevel {
  if (mgdl < GLUCOSE_THRESHOLDS.LOW) return 'low';
  if (mgdl > GLUCOSE_THRESHOLDS.HIGH) return 'high';
  
  if (context === 'pre-meal') {
    // Pre-meal target is 80-130 mg/dL
    if (mgdl >= GLUCOSE_THRESHOLDS.PRE_MEAL_MIN && mgdl <= GLUCOSE_THRESHOLDS.PRE_MEAL_MAX) {
      return 'in-target';
    }
    // Between 70-79 is considered low (below pre-meal target)
    if (mgdl >= GLUCOSE_THRESHOLDS.LOW && mgdl < GLUCOSE_THRESHOLDS.PRE_MEAL_MIN) {
      return 'low';
    }
    // Between 130-180 is considered high (above pre-meal target but not critically high)
    return 'high';
  }
  
  // Post-meal: < 180 is in-target
  if (context === 'post-meal') {
    if (mgdl <= GLUCOSE_THRESHOLDS.POST_MEAL_TARGET) {
      return 'in-target';
    }
  }
  
  return 'high';
}

/**
 * Get display text for glucose level
 */
export function getGlucoseLevelText(level: GlucoseLevel): string {
  switch (level) {
    case 'low': return 'Low';
    case 'in-target': return 'In Target';
    case 'high': return 'High';
  }
}

/**
 * Get color class for glucose level (badge styling)
 */
export function getGlucoseLevelColor(level: GlucoseLevel): string {
  switch (level) {
    case 'low': return 'bg-yellow-500 text-white';
    case 'in-target': return 'bg-green-500 text-white';
    case 'high': return 'bg-red-500 text-white';
  }
}

// ========================================
// Carbohydrate Range Guidelines
// ========================================

export const CARB_RANGES = {
  LOW: {
    dailyPercent: '< 26%',
    dailyGramsAt2000Kcal: '< 130 g/day',
    perMealGuide: '~15-30 g',
    description: 'Low carbohydrate approach for tighter glucose control',
  },
  MODERATE: {
    dailyPercent: '26-44%',
    dailyGramsAt2000Kcal: '130-220 g/day',
    perMealGuide: '~30-60 g',
    description: 'Moderate carbohydrate approach balancing flexibility and control',
  },
  HIGH: {
    dailyPercent: '≥ 45%',
    dailyGramsAt2000Kcal: '≥ 225 g/day',
    perMealGuide: '> 50-60 g',
    description: 'Higher carbohydrate approach with emphasis on quality and timing',
  },
} as const;

// ========================================
// Educational Content Sections
// ========================================

export const EDUCATIONAL_SECTIONS = {
  bloodSugarMeaning: {
    title: 'What do my blood sugar readings mean?',
    content: `Understanding your blood glucose readings helps you make informed decisions throughout the day:

• **Low (< 70 mg/dL):** Hypoglycemia - treat promptly with 15g fast-acting carbs (glucose tablets, juice, regular soda). Recheck in 15 minutes.

• **Pre-meal target (80-130 mg/dL):** Ideal range before eating. This helps prevent post-meal spikes.

• **Post-meal target (< 180 mg/dL):** Measured 1-2 hours after eating. Staying below this helps reduce long-term complications.

• **High (> 180 mg/dL):** Hyperglycemia - if persistent, talk to your care team about medication adjustments, meal timing, or activity changes.

Remember: These are general targets. Your healthcare provider may set different goals based on your specific situation, medications, and health history.`,
    sources: [
      'American Diabetes Association (ADA). Standards of Care in Diabetes—2024, Section 6: Glycemic Targets.',
      'CDC. Manage Blood Sugar / Monitoring Blood Sugar.',
    ],
  },
  
  monitoringFrequency: {
    title: 'How often should I check?',
    content: `Monitoring frequency depends on your diabetes type, medications, and management goals:

• **Type 1 Diabetes:** Often 4-10 times per day, especially before meals, before bed, and when adjusting insulin.

• **Type 2 Diabetes (on insulin):** Varies widely - often 1-4 times per day depending on insulin regimen.

• **Type 2 Diabetes (lifestyle or oral meds):** Less frequent monitoring may be appropriate. Discuss with your care team.

• **Continuous Glucose Monitors (CGM):** Provide real-time glucose data 24/7, reducing need for fingerstick testing.

Check more often when:
- Starting new medications
- Adjusting insulin doses  
- During illness or stress
- After unusual meals or activity
- When experiencing symptoms

Your diabetes educator can help create a monitoring schedule that fits your needs.`,
    sources: [
      'ADA. Standards of Care in Diabetes—2024, Section 7: Diabetes Technology.',
      'CDC. Monitoring Your Blood Sugar.',
    ],
  },
  
  carbsAndGlucose: {
    title: 'Carbs and your glucose',
    content: `Carbohydrates have the most direct impact on blood sugar. Understanding how they work helps you plan meals strategically:

**Amount matters:** Total grams of carbohydrate affect how much your glucose rises. Portion control is key.

**Type matters:** 
- Simple carbs (sugars) raise glucose quickly
- Complex carbs (whole grains, legumes) provide steadier energy
- Fiber slows digestion and blunts glucose spikes

**Pairing helps:**
- Combine carbs with protein (slows digestion)
- Add healthy fats (reduces glycemic response)  
- Include fiber-rich foods (vegetables, whole grains)

**Timing considerations:**
- Spacing carbs throughout the day prevents large spikes
- Post-meal activity can help lower glucose
- Evening carbs may affect fasting glucose

**Glycemic Index (GI) & Load (GL):**
- GI measures how quickly a food raises blood sugar
- GL factors in both speed and portion size
- Lower GI/GL foods generally cause gentler glucose curves

The goal isn't to eliminate carbs—it's to choose quality sources, control portions, and time them strategically around your activity and medications.`,
    sources: [
      'ADA Nutrition Consensus Report, 2019.',
      'Harvard T.H. Chan School of Public Health. Carbohydrates and Blood Sugar.',
    ],
  },
} as const;

// ========================================
// Advisory Messages
// ========================================

export const ADVISORY_MESSAGES = {
  carbRangeGuideInfo: `If your most recent glucose is > 180 mg/dL, prefer Low Glycemic / Low Carb meals today; if you're within 80-130 mg/dL before meals, your standard plan is fine. Always follow your clinician's guidance.`,
  
  highGlucoseSuggestion: (reading: number) => 
    `Last reading ${reading} mg/dL (High) → consider Low Glycemic meals today.`,
  
  lowGlucoseSuggestion: (reading: number) =>
    `Last reading ${reading} mg/dL (Low) → treat immediately with fast-acting carbs.`,
  
  inTargetSuggestion: (reading: number) =>
    `Last reading ${reading} mg/dL (In Target) → your standard meal plan is appropriate.`,
} as const;

// ========================================
// Disclaimer Text
// ========================================

export const DISCLAIMER = {
  short: 'Educational only; not medical advice. Follow your clinician\'s guidance.',
  full: 'My Perfect Meals is designed to work with your doctor, dietitian, or diabetes educator — never instead of them. Use the information and tools here to stay consistent between visits, to understand your body, and to make small, confident choices that honor your professional guidance. Every chart, every meal, and every suggestion in this app is meant to support your care plan, not replace it.',
} as const;

// ========================================
// Clinical References (Full List)
// ========================================

export const CLINICAL_REFERENCES = [
  {
    key: 'ada-2024-glycemic-targets',
    citation: 'American Diabetes Association (ADA). Standards of Care in Diabetes—2024, Section 6: Glycemic Targets.',
    url: 'https://diabetesjournals.org/care/issue/47/Supplement_1',
  },
  {
    key: 'ada-2024-technology',
    citation: 'ADA. Standards of Care in Diabetes—2024, Section 7: Diabetes Technology.',
    url: 'https://diabetesjournals.org/care/issue/47/Supplement_1',
  },
  {
    key: 'ada-nutrition-2019',
    citation: 'ADA Nutrition Consensus Report, 2019.',
    url: 'https://diabetesjournals.org/care/article/42/5/731/40480/Nutrition-Therapy-for-Adults-With-Diabetes-or',
  },
  {
    key: 'cdc-blood-sugar',
    citation: 'CDC. Manage Blood Sugar / Monitoring Blood Sugar.',
    url: 'https://www.cdc.gov/diabetes/managing/manage-blood-sugar.html',
  },
  {
    key: 'harvard-carbs',
    citation: 'Harvard T.H. Chan School of Public Health. Carbohydrates and Blood Sugar.',
    url: 'https://www.hsph.harvard.edu/nutritionsource/carbohydrates/carbohydrates-and-blood-sugar/',
  },
  {
    key: 'iom-amdr',
    citation: 'Institute of Medicine. Acceptable Macronutrient Distribution Range (AMDR) for carbohydrates.',
    url: 'https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx',
  },
] as const;
