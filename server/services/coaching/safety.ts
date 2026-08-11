/**
 * Coaching Engine — Safety Gate
 *
 * Runs BEFORE any Observer, pattern match, or LLM call.
 * If a red flag is triggered, coaching stops entirely and a safe redirect is returned.
 *
 * Global rules are hardcoded and cannot be disabled by any specialization adapter.
 * Specialization adapters can only ADD additional rules — never remove global ones.
 *
 * The pediatric adapter will be MORE restrictive than adult. The engine enforces
 * this by always merging (never replacing) global + specialization rules.
 */

import type { SafetyClass } from "../../../shared/coaching/types";

export interface SafetyAssessment {
  triggered: boolean;
  class: SafetyClass;
  reason?: string;
  /**
   * Safe response to return to the user if triggered.
   * The engine returns this verbatim — no LLM call.
   */
  suggestedResponse?: string;
}

// ─── Global Adult Red Flags ───────────────────────────────────────────────────
// These cannot be disabled by any specialization adapter or knowledge pattern.

interface RedFlag {
  key: string;
  class: SafetyClass;
  patterns: string[];
  response: string;
}

const GLOBAL_ADULT_RED_FLAGS: RedFlag[] = [
  {
    key: "suicidal_ideation",
    class: "emergency",
    patterns: [
      "kill myself", "end my life", "don't want to be here",
      "suicidal", "suicide", "hurt myself", "harm myself", "self-harm",
      "cutting myself", "not worth living",
    ],
    response:
      "I'm really glad you're talking, and I want to make sure you're okay. " +
      "What you're describing is beyond what I can help with as a nutrition coach — " +
      "please reach out to a crisis line right now. In the US, you can call or text 988 (Suicide & Crisis Lifeline), " +
      "or text HOME to 741741. If you're in immediate danger, please call 911.",
  },
  {
    key: "acute_cardiac",
    class: "emergency",
    patterns: [
      "chest pain", "chest tightness", "chest pressure", "heart attack",
      "heart is racing", "can't breathe", "trouble breathing", "short of breath",
      "arm is numb", "jaw pain",
    ],
    response:
      "Those symptoms sound like they need immediate medical attention. " +
      "Please call 911 or have someone take you to the emergency room right now. " +
      "Don't wait — get checked out first, and we can talk about nutrition when you're safe.",
  },
  {
    key: "severe_allergic_reaction",
    class: "emergency",
    patterns: [
      "throat swelling", "throat is closing", "anaphylaxis", "epipen",
      "allergic reaction", "hives everywhere", "face is swelling",
    ],
    response:
      "If you're having a severe allergic reaction, use your EpiPen if you have one and call 911 immediately. " +
      "Please get medical help right now — this is a medical emergency.",
  },
  {
    key: "eating_disorder_signals",
    class: "escalate",
    patterns: [
      "throwing up after eating", "make myself throw up", "purging",
      "binge and purge", "laxatives to lose weight", "afraid to eat",
      "terrified of food", "haven't eaten in days", "refusing to eat",
    ],
    response:
      "Thank you for trusting me with this — it takes courage to share. " +
      "What you're describing is something I want to make sure gets the right kind of support, " +
      "which is beyond nutrition coaching. " +
      "Please consider reaching out to the National Eating Disorders Association helpline: " +
      "1-800-931-2237 or text 'NEDA' to 741741. Your doctor or a therapist who specializes in this can really help.",
  },
  {
    key: "diabetic_emergency",
    class: "emergency",
    patterns: [
      "blood sugar is 400", "blood sugar is 500", "diabetic ketoacidosis",
      "DKA", "ketoacidosis", "insulin shock", "hypoglycemia attack",
      "blood sugar is really low", "passed out from blood sugar",
    ],
    response:
      "This sounds like a medical emergency. Please call 911 or get to an emergency room immediately. " +
      "If you have a glucagon kit or emergency supplies, use them now. Don't wait.",
  },
  {
    key: "pregnancy_complication",
    class: "emergency",
    patterns: [
      "bleeding heavily during pregnancy", "severe cramping pregnant",
      "baby isn't moving", "fetal movement stopped", "fetus not moving",
      "bright red bleeding", "severe abdominal pain pregnant",
    ],
    response:
      "Please call your OB or midwife immediately, or go to the emergency room. " +
      "What you're describing needs to be evaluated by a medical professional right away. " +
      "Please don't wait.",
  },
  {
    key: "loss_of_consciousness",
    class: "emergency",
    patterns: [
      "i fainted", "i blacked out", "passed out", "lost consciousness",
      "i collapsed", "someone collapsed",
    ],
    response:
      "Fainting or losing consciousness needs to be evaluated by a doctor. " +
      "If it just happened and you're not feeling well, please call your doctor or go to an urgent care or ER. " +
      "Please don't drive yourself.",
  },
  {
    key: "diagnosis_request",
    class: "caution",
    patterns: [
      "do i have diabetes", "am i diabetic", "diagnose me",
      "is this cancer", "do i have thyroid", "do i have celiac",
      "test me for", "what disease do i have",
    ],
    response:
      "That's a really important question and one only a doctor can properly answer with the right tests. " +
      "I'm a nutrition coach — I can help you think about food and habits, but diagnosing conditions is beyond what I can do. " +
      "Please bring this to your doctor. If you'd like, I can help you think about what to ask them.",
  },
];

// ─── Safety Gate Function ─────────────────────────────────────────────────────

/**
 * Run the safety gate against the user message.
 *
 * @param message - The raw user message
 * @param specializationRules - Additional keyword patterns from the specialization adapter
 *                              (can only add restrictions, never remove global ones)
 * @returns SafetyAssessment — triggered=true means coaching must stop
 */
export async function runSafetyGate(
  message: string,
  specializationRules: string[] = []
): Promise<SafetyAssessment> {
  const normalized = message.toLowerCase();

  // Check global adult red flags first
  for (const flag of GLOBAL_ADULT_RED_FLAGS) {
    for (const pattern of flag.patterns) {
      if (normalized.includes(pattern.toLowerCase())) {
        console.log(`[SafetyGate] ⚠️ Red flag triggered: ${flag.key} (class: ${flag.class})`);
        return {
          triggered: true,
          class: flag.class,
          reason: flag.key,
          suggestedResponse: flag.response,
        };
      }
    }
  }

  // Check specialization-specific additional rules
  // These are extra restrictions from the adapter (e.g. pediatric will add more)
  for (const rule of specializationRules) {
    if (normalized.includes(rule.toLowerCase())) {
      console.log(`[SafetyGate] ⚠️ Specialization rule triggered: ${rule}`);
      return {
        triggered: true,
        class: "escalate",
        reason: `specialization_rule: ${rule}`,
        suggestedResponse:
          "This is something I'd want to make sure gets the right kind of attention. " +
          "Please reach out to your care team or a qualified professional for guidance on this.",
      };
    }
  }

  return { triggered: false, class: "routine" };
}

/**
 * Build a safe emergency response for the user.
 * Used when the safety gate triggers and coaching must stop.
 */
export function buildSafetyResponse(assessment: SafetyAssessment) {
  return {
    whatIFound: "I noticed something in your message that I want to address directly.",
    whatItCouldMean: assessment.suggestedResponse ?? "This needs immediate attention from a qualified professional.",
    todayPlan: {
      why: "Your safety comes first — always.",
      items: [
        {
          horizon: "today" as const,
          kind: "contact_care" as const,
          text: assessment.suggestedResponse ?? "Please reach out to a qualified professional right away.",
        },
      ],
      successMetric: "You have reached out to the appropriate support.",
      nextCheckIn: "Come back when you're ready and I'll be here.",
    },
    learningOpportunity: null,
    meta: {
      specialization: "corner" as const,
      confidence: "low" as const,
      styleMode: "reassurance" as const,
      patternKeys: [],
      observersRun: [],
      redFlag: true,
    },
  };
}
