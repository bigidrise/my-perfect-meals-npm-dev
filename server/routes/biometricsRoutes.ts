import express from 'express';
import { db } from '../db';
import { biometricPayloadSchema, biometricSample, biometricSource } from '../../shared/biometricsSchema';
import { normalizeWeightToKg, normalizeWaistToCm, calculateDailySummaries, filterAllowedBiometrics } from '../services/biometricsService';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { openai } from '../utils/openaiSafe';

const router = express.Router();

// Ingest endpoint - accepts biometric data from devices/apps
router.post('/ingest', async (req, res) => {
  try {
    const body = biometricPayloadSchema.parse(req.body);

    // Privacy enforcement: filter out any non-approved data types
    const filteredSamples = filterAllowedBiometrics(body.samples);

    // Normalize units and prepare for database insertion
    const rows = filteredSamples.map(sample => {
      let normalizedValue = sample.value;
      let normalizedUnit = sample.unit;

      if (sample.type === 'weight') {
        normalizedValue = normalizeWeightToKg(sample.value, sample.unit);
        normalizedUnit = 'kg';
      } else if (sample.type === 'waist_circumference') {
        normalizedValue = normalizeWaistToCm(sample.value, sample.unit);
        normalizedUnit = 'cm';
      }

      return {
        userId: body.userId as any,
        provider: body.provider,
        deviceId: body.deviceId,
        type: sample.type,
        value: normalizedValue,
        unit: normalizedUnit,
        startTime: new Date(sample.startTime),
        endTime: new Date(sample.endTime),
        sourceRecordId: sample.sourceRecordId,
      };
    });

    // Insert biometric samples
    if (rows.length > 0) {
      await db.insert(biometricSample).values(rows);
    }

    res.status(201).json({ 
      inserted: rows.length,
      filtered: body.samples.length - filteredSamples.length,
      message: 'Biometric data ingested successfully'
    });
  } catch (error: any) {
    console.error('Biometrics ingest error:', error);
    res.status(400).json({ 
      error: 'Invalid biometrics payload', 
      detail: error?.message 
    });
  }
});

// Latest values endpoint - returns most recent weight, waist, BP, etc.
router.get('/latest', async (req, res) => {
  try {
    const userId = String(req.query.userId ?? '');
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const latestWeight = await db.select().from(biometricSample).where(
      and(
        eq(biometricSample.userId, userId as any),
        eq(biometricSample.type, 'weight')
      )
    ).orderBy(desc(biometricSample.startTime)).limit(1);

    const latestWaist = await db.select().from(biometricSample).where(
      and(
        eq(biometricSample.userId, userId as any),
        eq(biometricSample.type, 'waist_circumference')
      )
    ).orderBy(desc(biometricSample.startTime)).limit(1);

    // Get latest blood pressure from vital_bp table
    const { vitalBp } = await import('../../shared/schema');
    const latestBP = await db.select().from(vitalBp).where(
      eq(vitalBp.userId, userId as any)
    ).orderBy(desc(vitalBp.measuredAt)).limit(1);

    res.json({
      weight: latestWeight[0]?.value || null,
      waist_circumference: latestWaist[0]?.value || null,
      blood_pressure: latestBP[0] ? {
        systolic: latestBP[0].systolic,
        diastolic: latestBP[0].diastolic
      } : null,
    });
  } catch (error: any) {
    console.error('Biometrics latest error:', error);
    res.status(500).json({ error: 'Failed to fetch latest biometrics' });
  }
});

// Summary endpoint - provides daily biometric summaries for UI
router.get('/summary', async (req, res) => {
  try {
    const userId = String(req.query.userId ?? '');
    const from = new Date(String(req.query.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    const to = new Date(String(req.query.to ?? new Date()));

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Pull only steps/heart_rate/weight within the time range
    const samples = await db.select().from(biometricSample).where(
      and(
        eq(biometricSample.userId, userId as any),
        gte(biometricSample.startTime, from),
        lte(biometricSample.endTime, to)
      )
    ).orderBy(desc(biometricSample.startTime));

    // Calculate daily summaries
    const dailySummaries = calculateDailySummaries(samples);

    // Get today's data
    const today = new Date().toISOString().slice(0, 10);
    const todayData = dailySummaries.get(today);

    // Calculate 7-day averages
    const last7Days = Array.from(dailySummaries.values()).slice(0, 7);
    const avgSteps = last7Days.length > 0 
      ? Math.round(last7Days.reduce((sum, day) => sum + day.steps, 0) / last7Days.length)
      : 0;

    res.json({
      today: {
        steps: todayData?.steps || 0,
        maxHeartRate: todayData?.maxHeartRate || null,
        weight: todayData?.weight || null,
      },
      averages: {
        steps7Day: avgSteps,
        restingHeartRate: 62, // This would need more sophisticated calculation
      },
      dailySummaries: Object.fromEntries(dailySummaries),
      rawSamples: samples.length,
    });
  } catch (error: any) {
    console.error('Biometrics summary error:', error);
    res.status(500).json({ error: 'Failed to fetch biometric summary' });
  }
});

// Device connection status
router.get('/sources/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const sources = await db.select().from(biometricSource).where(
      eq(biometricSource.userId, userId as any)
    );

    res.json({ sources });
  } catch (error: any) {
    console.error('Biometrics sources error:', error);
    res.status(500).json({ error: 'Failed to fetch biometric sources' });
  }
});

// Register a new device/source
router.post('/sources', async (req, res) => {
  try {
    const { userId, provider, allowedMetrics } = req.body;

    if (!userId || !provider || !allowedMetrics) {
      return res.status(400).json({ error: 'userId, provider, and allowedMetrics required' });
    }

    // Create scope hash from allowed metrics (for privacy tracking)
    const scopeHash = Buffer.from(JSON.stringify(allowedMetrics.sort())).toString('base64');

    const source = await db.insert(biometricSource).values({
      userId: userId as any,
      provider,
      scopeHash,
    }).returning();

    res.status(201).json({ source: source[0] });
  } catch (error: any) {
    console.error('Biometrics source registration error:', error);
    res.status(500).json({ error: 'Failed to register biometric source' });
  }
});

// Macro logging endpoint for meal generators
router.post('/log', async (req, res) => {
  try {
    const { date_iso, meal_type, calories_kcal, protein_g, carbs_g, fat_g, source, title, meal_id } = req.body;

    // Use default user ID for development
    const userId = "00000000-0000-0000-0000-000000000001";

    console.log("📝 POST /api/biometrics/log", { userId, body: req.body });

    // Validate required fields
    if (!calories_kcal && !protein_g && !carbs_g && !fat_g) {
      return res.status(400).json({ 
        error: 'At least one macro value is required',
        detail: 'Please provide calories, protein, carbs, or fat'
      });
    }

    // Import and use the existing food logs system
    const { foodLogs } = await import('../../shared/schema');

    const [insertedRow] = await db.insert(foodLogs).values({
      userId,
      loggedAt: new Date(date_iso || new Date().toISOString()),
      mealType: meal_type || "lunch",
      foodName: title || "Meal",
      qty: "1",
      unit: "serving",
      calories: Number(calories_kcal) || 0,
      proteinG: String(Number(protein_g) || 0),
      carbsG: String(Number(carbs_g) || 0),
      fatG: String(Number(fat_g) || 0),
      meta: {
        source: source || "manual",
        mealId: meal_id
      }
    }).returning();

    console.log("✅ Biometrics log saved:", insertedRow);

    // Trigger UI refresh events
    res.status(201).json({ 
      ok: true, 
      id: insertedRow.id,
      message: "Macro logged successfully" 
    });

  } catch (error: any) {
    console.error('❌ Biometrics log error:', error);
    console.error('Error stack:', error?.stack);
    res.status(500).json({ 
      error: 'Failed to log macros', 
      detail: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Simple weight save endpoint (from Macro Calculator)
// Upserts weight by user_id + date to prevent duplicates
router.post('/weight', async (req, res) => {
  try {
    const userId = req.body.userId || "00000000-0000-0000-0000-000000000001";
    const { value, unit, localDate, measuredAt } = req.body;

    if (!value || !unit) {
      return res.status(400).json({ error: 'value and unit required' });
    }

    if (!['lb', 'kg'].includes(unit)) {
      return res.status(400).json({ error: 'unit must be lb or kg' });
    }

    // Use localDate (client's local YYYY-MM-DD) if provided, otherwise fall back to measuredAt or today
    // This ensures the date matches what the user sees in their timezone
    let dayKey: string;
    let measurementDate: Date;
    
    if (localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      // Client sent local date string - use it directly for day key
      dayKey = localDate;
      // Create date at noon UTC to avoid timezone edge cases
      measurementDate = new Date(`${localDate}T12:00:00Z`);
    } else if (measuredAt) {
      // Legacy: measuredAt ISO string
      measurementDate = new Date(measuredAt);
      dayKey = measurementDate.toISOString().slice(0, 10);
    } else {
      // Default: use server's current date
      measurementDate = new Date();
      dayKey = measurementDate.toISOString().slice(0, 10);
    }
    
    // Check if weight already exists for this day
    const existing = await db.select().from(biometricSample).where(
      and(
        eq(biometricSample.userId, userId as any),
        eq(biometricSample.type, 'weight')
      )
    );

    // Filter to find same-day entry
    const sameDayEntry = existing.find(row => {
      const rowDate = new Date(row.startTime).toISOString().slice(0, 10);
      return rowDate === dayKey;
    });

    if (sameDayEntry) {
      // Update existing entry for this day
      await db.update(biometricSample)
        .set({ 
          value: Number(value), 
          unit,
          startTime: measurementDate,
          endTime: measurementDate,
        })
        .where(eq(biometricSample.id, sameDayEntry.id));

      console.log(`✅ Updated weight for ${userId} on ${dayKey}: ${value} ${unit}`);
      
      return res.json({ 
        ok: true,
        id: sameDayEntry.id, 
        value: Number(value), 
        unit, 
        measuredAt: measurementDate.toISOString(),
        updated: true
      });
    } else {
      // Insert new entry
      const [inserted] = await db.insert(biometricSample).values({
        userId: userId as any,
        provider: 'macro-calculator',
        type: 'weight',
        value: Number(value),
        unit,
        startTime: measurementDate,
        endTime: measurementDate,
      }).returning();

      console.log(`✅ Created weight entry for ${userId} on ${dayKey}: ${value} ${unit}`);

      return res.json({ 
        ok: true,
        id: inserted.id, 
        value: Number(value), 
        unit, 
        measuredAt: measurementDate.toISOString(),
        created: true
      });
    }
  } catch (error: any) {
    console.error('Weight save error:', error);
    res.status(500).json({ 
      error: 'Failed to save weight', 
      detail: error?.message 
    });
  }
});

// Get weight history with optional date range
router.get('/weight', async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "00000000-0000-0000-0000-000000000001");
    const range = String(req.query.range ?? '90d');
    
    // Parse range (e.g., "90d", "30d", "7d")
    const daysMatch = range.match(/^(\d+)d$/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 90;
    
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Fetch weight entries
    const weights = await db.select().from(biometricSample).where(
      and(
        eq(biometricSample.userId, userId as any),
        eq(biometricSample.type, 'weight'),
        gte(biometricSample.startTime, fromDate)
      )
    ).orderBy(desc(biometricSample.startTime));

    // Format for frontend
    const history = weights.map(w => ({
      id: w.id,
      date: w.startTime.toISOString().slice(0, 10),
      weight: w.value,
      unit: w.unit,
      measuredAt: w.startTime.toISOString(),
    }));

    res.json({ 
      history,
      latest: history[0] || null,
      count: history.length
    });

  } catch (error: any) {
    console.error('Weight fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weight history', 
      detail: error?.message 
    });
  }
});

router.post('/analyze-photo', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Base64 image data required' });
    }

    const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a nutrition analysis expert. Analyze the food in the image and estimate its macronutrients.
Return ONLY valid JSON in this exact format:
{
  "calories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>,
  "description": "<brief description of the food>"
}
Be realistic with portion sizes shown. If you cannot identify food, return zeros with description explaining why.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this food image and estimate the macros:' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      res.json({
        calories: Math.round(parsed.calories ?? 0),
        protein: Math.round(parsed.protein ?? 0),
        carbs: Math.round(parsed.carbs ?? 0),
        fat: Math.round(parsed.fat ?? 0),
        description: parsed.description ?? 'Food analyzed',
        source: 'ai'
      });
    } catch (aiError: any) {
      console.log('AI photo analysis unavailable, using deterministic fallback');
      res.json({
        calories: 350,
        protein: 25,
        carbs: 35,
        fat: 12,
        description: 'Estimated meal (AI unavailable - using average meal values)',
        source: 'fallback'
      });
    }

  } catch (error: any) {
    console.error('Photo macro analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze photo', 
      detail: error?.message 
    });
  }
});

export default router;