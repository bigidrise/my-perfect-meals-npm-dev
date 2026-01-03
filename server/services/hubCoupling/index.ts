import type { 
  HubType, 
  HubModule, 
  HubContext, 
  HubGuardrails, 
  PromptFragment,
  ValidationResult,
  HubCouplingResult,
  ValidationViolation
} from './types';
import type { UnifiedMeal } from '../unifiedMealPipeline';

const hubRegistry = new Map<HubType, HubModule>();
let hubsRegistered = false;

const VALID_HUB_TYPES: HubType[] = ['diabetic', 'competition_pro', 'glp1', 'anti_inflammatory'];

export function registerHub(module: HubModule): void {
  if (hubRegistry.has(module.hubType)) {
    return;
  }
  hubRegistry.set(module.hubType, module);
  console.log(`🔌 Hub registered: ${module.hubType}`);
}

export function getHubModule(hubType: HubType): HubModule | undefined {
  return hubRegistry.get(hubType);
}

export function getRegisteredHubs(): HubType[] {
  return Array.from(hubRegistry.keys());
}

export function isValidHubType(dietType: string | null | undefined): dietType is HubType {
  return !!dietType && VALID_HUB_TYPES.includes(dietType as HubType);
}

export async function detectHubTypeFromProfile(userId: string): Promise<HubType | null> {
  try {
    const { db } = await import('../../db');
    const { diabetesProfile, glp1Shots } = await import('../../../shared/schema');
    const { eq, desc } = await import('drizzle-orm');
    
    const [diabeticProfile] = await db.select()
      .from(diabetesProfile)
      .where(eq(diabetesProfile.userId, userId))
      .limit(1);
    
    if (diabeticProfile) {
      console.log(`🩺 Auto-detected diabetic hub for user ${userId.substring(0, 8)}...`);
      return 'diabetic';
    }
    
    const [glp1Shot] = await db.select()
      .from(glp1Shots)
      .where(eq(glp1Shots.userId, userId))
      .orderBy(desc(glp1Shots.dateUtc))
      .limit(1);
    
    if (glp1Shot) {
      console.log(`💉 Auto-detected GLP-1 hub for user ${userId.substring(0, 8)}...`);
      return 'glp1';
    }
    
    return null;
  } catch (err) {
    console.warn('⚠️ Failed to detect hub type from profile:', err);
    return null;
  }
}

export async function ensureHubsRegistered(): Promise<void> {
  if (hubsRegistered) return;
  hubsRegistered = true;
  
  const { diabeticHubModule } = await import('./hubModules/diabetic');
  const { competitionProHubModule } = await import('./hubModules/competitionPro');
  const { glp1HubModule } = await import('./hubModules/glp1');
  const { antiInflammatoryHubModule } = await import('./hubModules/antiInflammatory');
  
  registerHub(diabeticHubModule);
  registerHub(competitionProHubModule);
  registerHub(glp1HubModule);
  registerHub(antiInflammatoryHubModule);
  
  console.log('✅ All hub coupling modules registered');
}

export async function resolveHubCoupling(
  hubType: HubType,
  userId: string,
  mealType: string
): Promise<HubCouplingResult | null> {
  const module = hubRegistry.get(hubType);
  if (!module) {
    console.warn(`⚠️ No hub module registered for: ${hubType}`);
    return null;
  }

  try {
    const context = module.getContext 
      ? await module.getContext(userId) 
      : null;
    
    const guardrails = await module.getGuardrails(userId);
    const promptFragment = module.buildPrompt(context, guardrails, mealType);

    console.log(`✅ Hub coupling resolved for ${hubType}: context=${!!context}, guardrails loaded`);

    return {
      context,
      guardrails,
      promptFragment
    };
  } catch (error) {
    console.error(`❌ Failed to resolve hub coupling for ${hubType}:`, error);
    return null;
  }
}

export function validateMealForHub(
  meal: UnifiedMeal,
  hubType: HubType,
  guardrails: HubGuardrails
): ValidationResult {
  const module = hubRegistry.get(hubType);
  if (!module) {
    return {
      isValid: true,
      violations: [],
      warnings: [`No validator registered for hub: ${hubType}`]
    };
  }

  return module.validate(meal, guardrails);
}

export function getRegenerationHint(
  hubType: HubType,
  violations: ValidationViolation[]
): string {
  const module = hubRegistry.get(hubType);
  if (module?.getFixHint) {
    return module.getFixHint(violations);
  }

  const hardViolations = violations.filter(v => v.severity === 'hard');
  if (hardViolations.length === 0) {
    return '';
  }

  const hints = hardViolations.map(v => {
    if (v.rule.includes('protein') && v.actualValue !== undefined) {
      return `increase protein to at least ${v.expectedValue}g`;
    }
    if (v.rule.includes('carb') && v.actualValue !== undefined) {
      return `reduce carbs to under ${v.expectedValue}g`;
    }
    if (v.rule.includes('fat') && v.actualValue !== undefined) {
      return `adjust fat content`;
    }
    return v.message;
  });

  return `Please regenerate the meal with these corrections: ${hints.join('; ')}. Keep the cuisine style and make it taste great.`;
}

export function hasHardViolations(result: ValidationResult): boolean {
  return result.violations.some(v => v.severity === 'hard');
}

export * from './types';
