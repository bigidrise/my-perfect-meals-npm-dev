import { Router } from 'express';
import { db } from '../db';
import { users, mealInstances, mealPlans } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const r = Router();

async function getOnboardingProfile(userId: string) {
  try {
    const resp = await fetch(`${process.env.APP_BASE_INTERNAL_URL || 'http://localhost:5000'}/api/onboarding/progress?userId=${userId}`, {
      headers: { 'x-device-id': 'internal' },
    });
    return resp.ok ? resp.json() : { steps: {} };
  } catch {
    return { steps: {} };
  }
}

async function getShoppingList(userId: string) {
  try {
    const resp = await fetch(`${process.env.APP_BASE_INTERNAL_URL || 'http://localhost:5000'}/api/shopping-list?userId=${userId}`, {
      headers: { 'x-device-id': 'internal' },
    });
    return resp.ok ? resp.json() : { items: [] };
  } catch { 
    return { items: [] }; 
  }
}

async function getTodaysMeals(userId: string) {
  const today = new Date().toISOString().slice(0,10);
  try {
    const activePlans = await db.select().from(mealPlans).where(eq(mealPlans.userId, userId));
    if (activePlans.length) {
      const plan = activePlans[0];
      // For now, return basic plan info - can be enhanced with meal details
      return { planId: plan.id, date: today, planName: plan.name };
    }
    const instances = await db.select().from(mealInstances).where(and(eq(mealInstances.userId, userId), eq(mealInstances.date, today as any)));
    return { date: today, instances };
  } catch (error) {
    console.error('Error fetching today\'s meals:', error);
    return { date: today, instances: [] };
  }
}

// Mock auth middleware for internal calls
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: req.headers['x-user-id'] || 'mock-user-id' };
  next();
};

r.get('/context', mockAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!u) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [profile, shopping, today] = await Promise.all([
      getOnboardingProfile(userId),
      getShoppingList(userId),
      getTodaysMeals(userId),
    ]);

    res.json({
      user: { 
        id: u.id, 
        email: u.email, 
        timezone: u.timezone,
        dietaryRestrictions: u.dietaryRestrictions || [],
        healthConditions: u.healthConditions || [],
        allergies: u.allergies || [],
        fitnessGoal: u.fitnessGoal
      },
      profile: profile.steps || {},
      shoppingList: shopping,
      today,
    });
  } catch (error) {
    console.error('Avatar context error:', error);
    res.status(500).json({ error: 'Failed to fetch avatar context' });
  }
});

export default r;