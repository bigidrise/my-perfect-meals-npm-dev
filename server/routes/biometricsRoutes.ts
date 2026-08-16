import express from 'express';
import { db } from '../db';
import { biometricPayloadSchema, biometricSample, biometricSource } from '../../shared/biometricsSchema';
import { normalizeWeightToKg, normalizeWaistToCm, calculateDailySummaries, filterAllowedBiometrics } from '../services/biometricsService';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { openai, chatJson } from '../utils/openaiSafe';
import { requireAuth } from '../middleware/requireAuth';
import { requireActiveAccess } from '../middleware/requireActiveAccess';
import { getAuthUserId } from '../utils/getAuthUserId';
import { users } from '../../shared/schema';
import { companionProfiles } from '../db/schema/companionProfiles';
import { logAudit, getClientIp } from '../lib/auditLog';

const router = express.Router();

// Ingest endpoint - accepts biometric data from devices/apps
router.post('/ingest', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const body = biometricPayloadSchema.parse(req.body);

    const filteredSamples = filterAllowedBiometrics(body.samples);

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

      const now = new Date();
      return {
        userId: userId as any,
        provider: body.provider || 'manual',
        deviceId: body.deviceId,
        type: sample.type,
        value: normalizedValue,
        unit: normalizedUnit,
        startTime: sample.startTime ? new Date(sample.startTime) : now,
        endTime: sample.endTime ? new Date(sample.endTime) : now,
        sourceRecordId: sample.sourceRecordId,
      };
    });

    // Waist circumference: upsert by calendar day to prevent duplicate rows
    // from accumulating when the user saves multiple times from MacroCalculator.
    // All other metric types insert normally (wearables send de-duplicated data).
    const otherRows = rows.filter(r => r.type !== 'waist_circumference');
    const waistRows = rows.filter(r => r.type === 'waist_circumference');
    let insertedCount = 0;
    let updatedCount  = 0;

    await db.transaction(async (tx) => {
      if (otherRows.length > 0) {
        await tx.insert(biometricSample).values(otherRows);
        insertedCount += otherRows.length;
      }
      for (const row of waistRows) {
        const dayKey   = row.startTime.toISOString().slice(0, 10);
        const dayStart = new Date(`${dayKey}T00:00:00Z`);
        const dayEnd   = new Date(`${dayKey}T23:59:59Z`);
        const [existing] = await tx.select({ id: biometricSample.id })
          .from(biometricSample)
          .where(and(
            eq(biometricSample.userId, row.userId),
            eq(biometricSample.type, 'waist_circumference'),
            gte(biometricSample.startTime, dayStart),
            lte(biometricSample.startTime, dayEnd),
          ));
        if (existing) {
          await tx.update(biometricSample)
            .set({ value: row.value, unit: row.unit, startTime: row.startTime, endTime: row.endTime })
            .where(eq(biometricSample.id, existing.id));
          updatedCount++;
        } else {
          await tx.insert(biometricSample).values(row);
          insertedCount++;
        }
      }
    });

    logAudit({ actor: String(userId), action: "WRITE", resourceType: "biometric_sample", table: "biometric_sample", route: req.path, ip: getClientIp(req as any), meta: { count: insertedCount + updatedCount, inserted: insertedCount, updated: updatedCount, types: Array.from(new Set(filteredSamples.map(s => s.type))).join(",") } });
    res.status(201).json({ 
      inserted: insertedCount,
      updated: updatedCount,
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
router.get('/latest', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);

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
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const from = new Date(String(req.query.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    const to = new Date(String(req.query.to ?? new Date()));

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
router.get('/sources/:userId', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);

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
router.post('/sources', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { provider, allowedMetrics } = req.body;

    if (!provider || !allowedMetrics) {
      return res.status(400).json({ error: 'provider and allowedMetrics required' });
    }

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

// Macro logging endpoint — delegates to canonical macroLogService.
// Accepts legacy biometrics-format payload (calories_kcal, protein_g, carbs_g, fat_g)
// and maps it to the canonical service so all paths share one write implementation.
router.post('/log', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const {
      date_iso,
      meal_type,
      calories_kcal,
      protein_g,
      carbs_g,
      fat_g,
      starchy_g,
      fiber_g,
      source,
      title,
      meal_id,
    } = req.body;

    if (!calories_kcal && !protein_g && !carbs_g && !fat_g) {
      return res.status(400).json({
        error: 'At least one macro value is required',
        detail: 'Please provide calories, protein, carbs, or fat',
      });
    }

    const { writeMacroLog } = await import('../services/macroLogService');
    const row = await writeMacroLog({
      userId,
      calories: Number(calories_kcal) || 0,
      protein: Number(protein_g) || 0,
      carbohydrates: Number(carbs_g) || 0,
      fat: Number(fat_g) || 0,
      fiber: fiber_g != null ? Number(fiber_g) : null,
      starchyCarbs: starchy_g != null ? Number(starchy_g) : null,
      source: String(source || "quick"),
      mealType: meal_type,
      dateIso: date_iso,
      mealId: meal_id,
      title,
    });

    res.status(201).json({ ok: true, id: row?.id, message: "Macro logged successfully" });
  } catch (error: any) {
    console.error('❌ Biometrics log error:', error);
    res.status(500).json({
      error: 'Failed to log macros',
      detail: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Simple weight save endpoint (from Macro Calculator)
// Upserts weight by user_id + date to prevent duplicates
// Atomic: updates both biometric_sample (canonical history) and users.weight (denormalized current kg)
router.post('/weight', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { value, unit, localDate, measuredAt } = req.body;

    if (!value || !unit) {
      return res.status(400).json({ error: 'value and unit required' });
    }

    if (!['lb', 'kg'].includes(unit)) {
      return res.status(400).json({ error: 'unit must be lb or kg' });
    }

    let dayKey: string;
    let measurementDate: Date;
    
    if (localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      dayKey = localDate;
      measurementDate = new Date(`${localDate}T12:00:00Z`);
    } else if (measuredAt) {
      measurementDate = new Date(measuredAt);
      dayKey = measurementDate.toISOString().slice(0, 10);
    } else {
      measurementDate = new Date();
      dayKey = measurementDate.toISOString().slice(0, 10);
    }

    const weightKg = unit === 'lb' ? Math.round(Number(value) / 2.20462) : Math.round(Number(value));

    const result = await db.transaction(async (tx) => {
      const existing = await tx.select().from(biometricSample).where(
        and(
          eq(biometricSample.userId, userId as any),
          eq(biometricSample.type, 'weight')
        )
      );

      const sameDayEntry = existing.find(row => {
        const rowDate = new Date(row.startTime).toISOString().slice(0, 10);
        return rowDate === dayKey;
      });

      let sampleResult: { id: any; updated: boolean; created: boolean };

      if (sameDayEntry) {
        await tx.update(biometricSample)
          .set({ 
            value: Number(value), 
            unit,
            startTime: measurementDate,
            endTime: measurementDate,
          })
          .where(eq(biometricSample.id, sameDayEntry.id));
        sampleResult = { id: sameDayEntry.id, updated: true, created: false };
      } else {
        const [inserted] = await tx.insert(biometricSample).values({
          userId: userId as any,
          provider: 'macro-calculator',
          type: 'weight',
          value: Number(value),
          unit,
          startTime: measurementDate,
          endTime: measurementDate,
        }).returning();
        sampleResult = { id: inserted.id, updated: false, created: true };
      }

      await tx.update(users)
        .set({ weight: weightKg })
        .where(eq(users.id, userId as any));

      return sampleResult;
    });

    logAudit({ actor: String(userId), action: "WRITE", resourceType: "biometric_weight", table: "biometric_sample", resourceId: result.id, route: req.path, ip: getClientIp(req as any), meta: { unit, updated: result.updated } });
    console.log(`[biometrics] Weight saved for user ${userId}`);

    return res.json({ 
      ok: true,
      id: result.id, 
      value: Number(value), 
      unit, 
      measuredAt: measurementDate.toISOString(),
      updated: result.updated,
      created: result.created
    });
  } catch (error: any) {
    console.error('Weight save error:', error);
    res.status(500).json({ 
      error: 'Failed to save weight', 
      detail: error?.message 
    });
  }
});

// Get weight history with optional date range
router.get('/weight', requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const userId = authUser?.id;
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

// ── Reusable metric-history endpoint ─────────────────────────────────────────
// GET /api/biometrics/history?metric=weight|waist_circumference|body_fat_percentage&range=7d|30d|90d|180d|365d
// Groups by local day (latest per day), normalises to display units, returns newest-first.
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const metric = String(req.query.metric ?? 'weight');
    const range  = String(req.query.range  ?? '90d');

    const allowed = ['weight', 'waist_circumference', 'body_fat_percentage'];
    if (!allowed.includes(metric)) {
      return res.status(400).json({ error: `metric must be one of: ${allowed.join(', ')}` });
    }

    const daysMatch = range.match(/^(\d+)d$/);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 90;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // DB-level filter — never load all rows and slice in JS
    const samples = await db.select().from(biometricSample).where(
      and(
        eq(biometricSample.userId, userId as any),
        eq(biometricSample.type, metric),
        gte(biometricSample.startTime, fromDate),
      )
    ).orderBy(desc(biometricSample.startTime));

    // One entry per calendar day — take the latest for that day (already sorted desc)
    const byDay = new Map<string, typeof samples[0]>();
    for (const s of samples) {
      const day = s.startTime.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, s);
    }

    const history = Array.from(byDay.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([date, s]) => {
        let displayValue = s.value;
        let displayUnit  = s.unit;
        if (s.type === 'weight') {
          displayValue = s.unit === 'kg' ? parseFloat((s.value * 2.20462).toFixed(1)) : s.value;
          displayUnit  = 'lb';
        } else if (s.type === 'waist_circumference') {
          displayValue = s.unit === 'cm' ? parseFloat((s.value / 2.54).toFixed(1)) : s.value;
          displayUnit  = 'in';
        }
        return { id: s.id, date, value: displayValue, unit: displayUnit, measuredAt: s.startTime.toISOString() };
      });

    const latest   = history[0] ?? null;
    const earliest = history[history.length - 1] ?? null;
    const change   = latest && earliest && history.length > 1
      ? parseFloat((latest.value - earliest.value).toFixed(1))
      : null;

    return res.json({ metric, range, history, latest, earliest, change, count: history.length });
  } catch (err: any) {
    console.error('[biometrics/history] error:', err);
    return res.status(500).json({ error: 'Failed to fetch metric history', detail: err?.message });
  }
});

// ── Measurement-only log ──────────────────────────────────────────────────────
// POST /api/biometrics/measurement
// Writes to biometric_sample with same-day upsert.
// Does NOT update users.weight — keeps measurement history separate from the
// macro-prescription baseline, per the advisor's tracking-vs-prescription rule.
router.post('/measurement', requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { metric, value, unit, localDate } = req.body;

    const allowedMetrics = ['weight', 'waist_circumference'];
    if (!allowedMetrics.includes(metric)) {
      return res.status(400).json({ error: 'metric must be weight or waist_circumference' });
    }
    if (!value || !unit) {
      return res.status(400).json({ error: 'value and unit required' });
    }

    let dayKey: string;
    let measurementDate: Date;
    if (localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      dayKey = localDate;
      measurementDate = new Date(`${localDate}T12:00:00Z`);
    } else {
      measurementDate = new Date();
      dayKey = measurementDate.toISOString().slice(0, 10);
    }

    // Normalise to canonical storage units (kg for weight, cm for waist)
    let storedValue = Number(value);
    let storedUnit  = String(unit);
    if (metric === 'waist_circumference') {
      storedValue = normalizeWaistToCm(storedValue, storedUnit);
      storedUnit  = 'cm';
    }

    const dayStart = new Date(`${dayKey}T00:00:00Z`);
    const dayEnd   = new Date(`${dayKey}T23:59:59Z`);

    const result = await db.transaction(async (tx) => {
      const existing = await tx.select().from(biometricSample).where(
        and(
          eq(biometricSample.userId, userId as any),
          eq(biometricSample.type, metric),
          gte(biometricSample.startTime, dayStart),
          lte(biometricSample.startTime, dayEnd),
        )
      );

      if (existing.length > 0) {
        await tx.update(biometricSample)
          .set({ value: storedValue, unit: storedUnit, startTime: measurementDate, endTime: measurementDate })
          .where(eq(biometricSample.id, existing[0].id));
        return { id: existing[0].id, updated: true, created: false };
      } else {
        const [inserted] = await tx.insert(biometricSample).values({
          userId: userId as any,
          provider: 'manual',
          type: metric,
          value: storedValue,
          unit: storedUnit,
          startTime: measurementDate,
          endTime: measurementDate,
        }).returning();
        return { id: inserted.id, updated: false, created: true };
      }
    });

    logAudit({ actor: String(userId), action: "WRITE", resourceType: "biometric_measurement", table: "biometric_sample", resourceId: result.id, route: req.path, ip: getClientIp(req as any), meta: { metric, unit, updated: result.updated } });
    return res.json({ ok: true, ...result, measuredAt: measurementDate.toISOString() });
  } catch (err: any) {
    console.error('[biometrics/measurement] error:', err);
    return res.status(500).json({ error: 'Failed to save measurement', detail: err?.message });
  }
});

router.post('/analyze-photo', requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { image, text } = req.body;

    if (!image && !text) {
      return res.status(400).json({ error: 'Either base64 image data or a text description is required' });
    }

    try {
      let messages: any[];

      if (text && typeof text === 'string') {
        // Text-based macro estimation (from Type or Speak mode)
        messages = [
          {
            role: 'system',
            content: `You are a nutrition analysis expert. The user will describe a food or meal in plain text. Estimate its macronutrients based on typical portion sizes.
Return ONLY valid JSON in this exact format:
{
  "calories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>,
  "description": "<brief description of the food>"
}
Be realistic with portion sizes. If you cannot estimate macros, return zeros with a description explaining why.`,
          },
          { role: 'user', content: `Estimate the macros for: ${text}` },
        ];
      } else {
        // Image-based macro estimation
        const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
        messages = [
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
Be realistic with portion sizes shown. If you cannot identify food, return zeros with description explaining why.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this food image and estimate the macros:' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            ],
          },
        ];
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: "json_object" },
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

// Ingredient Intelligence — personalized ingredient alignment scan
router.post('/ingredient-intelligence', requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { image, text, companionId } = req.body;
    const hasImage = image && typeof image === 'string';
    const hasText = text && typeof text === 'string' && text.trim().length > 0;
    if (!hasImage && !hasText) {
      return res.status(400).json({ ok: false, error: 'Image data or ingredient text required' });
    }
    const userId = getAuthUserId(req);
    const imageUrl = hasImage ? (image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`) : undefined;

    let companionContext: string | undefined;
    if (companionId && userId) {
      try {
        const [dog] = await db
          .select()
          .from(companionProfiles)
          .where(and(eq(companionProfiles.id, companionId), eq(companionProfiles.userId, String(userId))));
        if (dog) {
          const allergies = (dog.allergies as string[]) || [];
          const sensitivities = (dog.foodSensitivities as string[]) || [];
          const goals = (dog.wellnessGoals as string[]) || [];
          const meds = (dog.medications as string[]) || [];
          companionContext = `DOG PROFILE (scanning for ${dog.name}):
- Name: ${dog.name}
- Breed: ${dog.breed}${dog.isMixedBreed ? " mix" : ""}
- Age: ${dog.ageYears}yr${dog.ageMonths ? ` ${dog.ageMonths}mo` : ""}  Weight: ${dog.weightLbs} lbs
- Activity: ${dog.activityLevel}  Diet type: ${dog.currentDietType || "commercial"}
- Wellness Goals: ${goals.join(", ") || "general wellness"}
- Known Allergies: ${allergies.join(", ") || "none"}
- Food Sensitivities: ${sensitivities.join(", ") || "none"}
- Medications: ${meds.join(", ") || "none"}
- Vet Dietary Notes: ${dog.vetDietaryRestrictions || "none"}`;
        }
      } catch {}
    }

    const { analyzeIngredientContent } = await import('../services/ingredientScanService');
    const result = await analyzeIngredientContent(String(userId), { imageDataUrl: imageUrl, rawText: text }, companionContext);
    return res.json({ ok: true, result });
  } catch (error: any) {
    console.error('Ingredient intelligence scan error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to analyze ingredients', detail: error?.message });
  }
});

// Barcode lookup — resolves UPC/EAN → product name via Open Food Facts, then runs the by-name scan.
// Falls back to the raw barcode string as productName if no DB match is found.
router.post('/ingredient-scan-by-barcode', requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { barcode } = req.body;
    if (!barcode || typeof barcode !== 'string' || !barcode.trim()) {
      return res.status(400).json({ ok: false, error: 'barcode is required' });
    }
    const cleanBarcode = barcode.trim().replace(/\D/g, '');
    if (!cleanBarcode) {
      return res.status(400).json({ ok: false, error: 'barcode must contain digits' });
    }

    // Resolve barcode → product name via Open Food Facts (free, no key needed)
    let productName: string = cleanBarcode;
    let resolvedFromDb = false;
    try {
      const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(cleanBarcode)}.json`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const offRes = await fetch(offUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MyPerfectMeals/1.0 (https://myperfectmeals.com)' },
      });
      clearTimeout(timeout);
      if (offRes.ok) {
        const offData: any = await offRes.json();
        if (offData?.status === 1 && offData?.product) {
          const p = offData.product;
          const name =
            p.product_name_en?.trim() ||
            p.product_name?.trim() ||
            p.abbreviated_product_name?.trim() ||
            '';
          if (name) {
            productName = name;
            resolvedFromDb = true;
          }
        }
      }
    } catch (lookupErr: any) {
      // Timeout or network error — continue with raw barcode as fallback
      console.warn('[barcode] Open Food Facts lookup failed:', lookupErr?.message);
    }

    const userId = getAuthUserId(req);
    const { analyzeProductByName } = await import('../services/ingredientScanService');
    const result = await analyzeProductByName(productName, String(userId));
    return res.json({ ok: true, result, resolvedFromDb, resolvedName: productName });
  } catch (error: any) {
    console.error('Barcode scan error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to analyze barcode product', detail: error?.message });
  }
});

// Ingredient Intelligence — analyze by product name (front-label path)
// Uses AI knowledge of the named product to generate a personalized verdict + branded alternatives.
// NOT a verified label scan — accuracy disclaimer is included in the response.
router.post('/ingredient-scan-by-name', requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { productName } = req.body;
    if (!productName || typeof productName !== 'string' || !productName.trim()) {
      return res.status(400).json({ ok: false, error: 'productName is required' });
    }
    const userId = getAuthUserId(req);
    const { analyzeProductByName } = await import('../services/ingredientScanService');
    const result = await analyzeProductByName(productName.trim(), String(userId));
    return res.json({ ok: true, result });
  } catch (error: any) {
    console.error('Ingredient by-name scan error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to analyze product by name', detail: error?.message });
  }
});

// Full Product Advisor — highest-confidence analysis using BOTH product name AND verified label
// Called when the user has scanned the label AND identified the product name.
router.post('/ingredient-scan-full', requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { productName, ingredients } = req.body;
    if (!productName || typeof productName !== 'string' || !productName.trim()) {
      return res.status(400).json({ ok: false, error: 'productName is required' });
    }
    if (!ingredients || typeof ingredients !== 'string' || !ingredients.trim()) {
      return res.status(400).json({ ok: false, error: 'ingredients is required' });
    }
    const userId = getAuthUserId(req);
    const { analyzeFullProduct } = await import('../services/ingredientScanService');
    const result = await analyzeFullProduct(productName.trim(), ingredients.trim(), String(userId));
    return res.json({ ok: true, result });
  } catch (error: any) {
    console.error('Full Product Advisor error:', error);
    return res.status(500).json({ ok: false, error: 'Full Product Advisor failed', detail: error?.message });
  }
});

// Estimate macros from natural language description
router.post('/estimate-macros', requireAuth, async (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const systemPrompt = `You are a nutrition estimation assistant. Given a description of food, estimate the macronutrients.

IMPORTANT RULES:
1. Provide reasonable estimates based on typical serving sizes
2. If portion size is mentioned, adjust accordingly
3. For branded items (like Cinnabon), use known nutritional data if available
4. Be conservative with estimates - it's better to slightly underestimate than overestimate
5. Separate carbs into starchy (bread, rice, pasta, potatoes, sugary items) and fibrous (vegetables, salads)

Respond ONLY with valid JSON in this exact format:
{
  "protein": <number in grams>,
  "carbs": <number in grams, total>,
  "starchyCarbs": <number in grams, starchy portion>,
  "fibrousCarbs": <number in grams, fibrous portion>,
  "fat": <number in grams>,
  "calories": <number>
}`;

    const result = await chatJson({
      system: systemPrompt,
      user: `Estimate the macros for: "${description.trim()}"`,
      model: 'gpt-4o-mini',
      temperature: 0.3,
    });

    // Validate and sanitize the response
    const macros = {
      protein: Math.max(0, Math.round(Number(result.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(result.carbs) || 0)),
      starchyCarbs: Math.max(0, Math.round(Number(result.starchyCarbs) || 0)),
      fibrousCarbs: Math.max(0, Math.round(Number(result.fibrousCarbs) || 0)),
      fat: Math.max(0, Math.round(Number(result.fat) || 0)),
      calories: Math.max(0, Math.round(Number(result.calories) || 0)),
    };

    // Ensure starchy + fibrous doesn't exceed total carbs
    if (macros.starchyCarbs + macros.fibrousCarbs > macros.carbs) {
      const ratio = macros.carbs / (macros.starchyCarbs + macros.fibrousCarbs);
      macros.starchyCarbs = Math.round(macros.starchyCarbs * ratio);
      macros.fibrousCarbs = Math.round(macros.fibrousCarbs * ratio);
    }

    res.json(macros);
  } catch (error: any) {
    console.error('Macro estimation error:', error);
    
    // Return fallback values if AI fails
    res.json({
      protein: 15,
      carbs: 30,
      starchyCarbs: 25,
      fibrousCarbs: 5,
      fat: 10,
      calories: 270,
      fallback: true,
    });
  }
});

export default router;