import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/requireAuth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

const MAX_SLOTS = 6;

function ownedWhere(userId: string, id?: string) {
  if (id) return sql`user_id = ${userId} AND id = ${id}::uuid`;
  return sql`user_id = ${userId}`;
}

// GET /api/user/reminders — return all slots for the authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const result = await db.execute(sql`
      SELECT id, label, time, enabled, type, sort_order
      FROM user_reminder_slots
      WHERE user_id = ${userId}
      ORDER BY sort_order ASC, created_at ASC
    `);
    res.json({ slots: result.rows });
  } catch (err: any) {
    console.error('[reminders] GET error:', err.message);
    res.status(500).json({ error: 'Failed to load reminders' });
  }
});

// PUT /api/user/reminders — full replace (client sends complete list)
router.put('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { slots } = req.body as {
      slots: Array<{ id?: string; label: string; time: string; enabled: boolean; sortOrder?: number }>;
    };

    if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots must be an array' });
    if (slots.length > MAX_SLOTS) return res.status(400).json({ error: `Maximum ${MAX_SLOTS} reminders allowed` });

    // Delete all existing slots for this user, then insert fresh
    await db.execute(sql`DELETE FROM user_reminder_slots WHERE user_id = ${userId}`);

    if (slots.length > 0) {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const label = (s.label || 'Meal').slice(0, 40);
        const time = (s.time || '12:00').slice(0, 5);
        const enabled = s.enabled !== false;
        const sortOrder = i;
        await db.execute(sql`
          INSERT INTO user_reminder_slots (user_id, label, time, enabled, type, sort_order, updated_at)
          VALUES (${userId}, ${label}, ${time}, ${enabled}, 'meal', ${sortOrder}, now())
        `);
      }
    }

    const result = await db.execute(sql`
      SELECT id, label, time, enabled, type, sort_order
      FROM user_reminder_slots
      WHERE user_id = ${userId}
      ORDER BY sort_order ASC
    `);
    res.json({ slots: result.rows });
  } catch (err: any) {
    console.error('[reminders] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to save reminders' });
  }
});

export default router;
