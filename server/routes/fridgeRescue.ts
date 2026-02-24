// 🔒 LOCKED: Deterministic Fridge Rescue API - DO NOT MODIFY
// This endpoint works perfectly with the new rule-based engine
// User confirmed it's working right - any changes will break functionality
import { Router } from 'express';
import { z } from 'zod';
import { generateFridgeMeals } from '../services/fridgeRescueEngine';
import { requireAuth } from '../middleware/requireAuth';
import { requireActiveAccess } from '../middleware/requireActiveAccess';

const router = Router();

const GenerateRequestSchema = z.object({
  items: z.array(z.string().min(1)).min(1, 'At least one item is required'),
  servings: z.number().int().min(1).max(12).default(2),
  dietFlags: z.array(z.string()).default([]),
});

router.post('/fridge-rescue/generate', requireAuth, requireActiveAccess, async (req, res) => {
  console.log('🔧 New deterministic fridge rescue request:', req.body);
  
  try {
    const parsed = GenerateRequestSchema.safeParse(req.body);
    
    if (!parsed.success) {
      console.error('❌ Validation failed:', parsed.error.flatten());
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: parsed.error.flatten().fieldErrors 
      });
    }

    const { items, servings, dietFlags } = parsed.data;
    
    const meals = generateFridgeMeals({ 
      items, 
      servings, 
      dietFlags: dietFlags as any[] 
    });
    
    console.log(`✅ Generated ${meals.length} meals successfully`);
    
    res.json({ meals });
  } catch (error: any) {
    console.error('❌ Fridge rescue engine error:', error);
    res.status(500).json({ 
      error: 'Failed to generate meals',
      message: error.message 
    });
  }
});

export { router as fridgeRescueRouter };