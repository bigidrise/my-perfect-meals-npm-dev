import express from 'express';
import { db } from '../db';
import { 
  cookingClasses,
  cookingClassJournal,
  cookingClassProgress,
  cookingClassVotes,
  insertCookingClassJournalSchema,
  insertCookingClassProgressSchema,
  insertCookingClassVoteSchema
} from '../../shared/schema';
import { eq, desc, sql, and, asc } from 'drizzle-orm';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/requireAuth';
import type { AuthenticatedRequest } from '../middleware/requireAuth';

const router = express.Router();

// Initialize OpenAI with API key
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Auth identity must be established first inside this router.
// See: express-async-subrouter-bug — Express v4 does not await async middleware
// in app.use(path, asyncFn, router). requireAuth inside the router guarantees
// req.authUser is set before any handler runs.
router.use(requireAuth);

// Get all classes by track (beginner, intermediate, advanced)
router.get('/tracks/:track', async (req, res) => {
  try {
    const { track } = req.params;
    
    if (!['beginner', 'intermediate', 'advanced'].includes(track)) {
      return res.status(400).json({ error: 'Invalid track. Must be beginner, intermediate, or advanced' });
    }

    const classes = await db
      .select()
      .from(cookingClasses)
      .where(and(
        eq(cookingClasses.track, track),
        eq(cookingClasses.isActive, true)
      ))
      .orderBy(asc(cookingClasses.order));

    res.json({ 
      track,
      classes,
      totalClasses: classes.length
    });
  } catch (error) {
    console.error('Error fetching classes by track:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get specific class details
router.get('/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;

    const classDetails = await db
      .select()
      .from(cookingClasses)
      .where(eq(cookingClasses.id, classId))
      .limit(1);

    if (!classDetails.length) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ class: classDetails[0] });
  } catch (error) {
    console.error('Error fetching class details:', error);
    res.status(500).json({ error: 'Failed to fetch class details' });
  }
});

// Get user's progress for a specific track — scoped to authenticated user
router.get('/progress/:userId/:track', async (req, res) => {
  try {
    const authUserId = (req as AuthenticatedRequest).authUser.id;
    const { userId, track } = req.params;

    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const progress = await db
      .select()
      .from(cookingClassProgress)
      .where(and(
        eq(cookingClassProgress.userId, authUserId),
        eq(cookingClassProgress.track, track)
      ))
      .limit(1);

    if (!progress.length) {
      const newProgress = await db
        .insert(cookingClassProgress)
        .values({
          userId: authUserId,
          track,
          completedClasses: [],
          currentModule: null,
          skillBadges: [],
          totalXp: 0
        })
        .returning();

      return res.json({ progress: newProgress[0] });
    }

    res.json({ progress: progress[0] });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Submit journal entry for a class — userId sourced from session, not body
router.post('/journal/submit', async (req, res) => {
  try {
    const authUserId = (req as AuthenticatedRequest).authUser.id;

    const entryData = insertCookingClassJournalSchema.parse({
      ...req.body,
      userId: authUserId
    });

    const existingEntry = await db
      .select()
      .from(cookingClassJournal)
      .where(and(
        eq(cookingClassJournal.userId, authUserId),
        eq(cookingClassJournal.classId, entryData.classId)
      ));

    if (existingEntry.length > 0) {
      return res.status(400).json({ error: 'User has already submitted a journal entry for this class' });
    }

    let aiScore = null;
    let aiFeedback = null;

    if (entryData.photoUrl && entryData.blurb) {
      try {
        const evaluation = await evaluateSubmissionWithAI(entryData.photoUrl, entryData.blurb);
        aiScore = evaluation.score;
        aiFeedback = evaluation.feedback;
      } catch (aiError) {
        console.error('AI evaluation failed:', aiError);
      }
    }

    const entry = await db
      .insert(cookingClassJournal)
      .values({
        ...entryData,
        aiScore,
        aiFeedback
      })
      .returning();

    await updateUserProgress(authUserId, entryData.classId, aiScore || 0);

    res.json({ 
      success: true,
      entry: entry[0]
    });
  } catch (error) {
    console.error('Error submitting journal entry:', error);
    res.status(500).json({ error: 'Failed to submit journal entry' });
  }
});

// Get journal entries for a class (community viewing)
router.get('/class/:classId/journal', async (req, res) => {
  try {
    const { classId } = req.params;

    const entries = await db
      .select({
        id: cookingClassJournal.id,
        userId: cookingClassJournal.userId,
        photoUrl: cookingClassJournal.photoUrl,
        blurb: cookingClassJournal.blurb,
        cookingUrl: cookingClassJournal.cookingUrl,
        aiScore: cookingClassJournal.aiScore,
        submittedAt: cookingClassJournal.submittedAt
      })
      .from(cookingClassJournal)
      .where(eq(cookingClassJournal.classId, classId))
      .orderBy(desc(cookingClassJournal.submittedAt));

    res.json({ entries });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// Vote on a journal entry — userId sourced from session, not body
router.post('/journal/:entryId/vote', async (req, res) => {
  try {
    const { entryId } = req.params;
    const authUserId = (req as AuthenticatedRequest).authUser.id;

    const voteData = insertCookingClassVoteSchema.parse({
      ...req.body,
      userId: authUserId,
      journalEntryId: entryId
    });

    const existingVote = await db
      .select()
      .from(cookingClassVotes)
      .where(and(
        eq(cookingClassVotes.userId, authUserId),
        eq(cookingClassVotes.journalEntryId, entryId)
      ));

    if (existingVote.length > 0) {
      return res.status(400).json({ error: 'User has already voted on this entry' });
    }

    const vote = await db
      .insert(cookingClassVotes)
      .values(voteData)
      .returning();

    res.json({ 
      success: true,
      vote: vote[0]
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// Get leaderboard for a track
router.get('/leaderboard/:track', async (req, res) => {
  try {
    const { track } = req.params;

    const leaderboard = await db
      .select({
        userId: cookingClassProgress.userId,
        totalXp: cookingClassProgress.totalXp,
        completedClassesCount: sql<number>`array_length(${cookingClassProgress.completedClasses}, 1)`,
        skillBadges: cookingClassProgress.skillBadges,
        lastActive: cookingClassProgress.lastActive
      })
      .from(cookingClassProgress)
      .where(eq(cookingClassProgress.track, track))
      .orderBy(desc(cookingClassProgress.totalXp))
      .limit(20);

    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

async function evaluateSubmissionWithAI(photoUrl: string, blurb: string): Promise<{ score: number; feedback: string }> {
  const prompt = `
    Evaluate this cooking class submission on a scale of 1-100:
    
    Photo URL: ${photoUrl}
    User Description: ${blurb}
    
    Consider:
    - Effort and presentation (40%)
    - Following cooking techniques (30%) 
    - Creativity and personal touch (20%)
    - Learning demonstration (10%)
    
    Respond with JSON: {"score": number, "feedback": "encouraging feedback with specific tips"}
  `;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a supportive cooking instructor. Give constructive, encouraging feedback that helps students improve their skills."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300
    });

    const result = JSON.parse(response.choices[0].message.content || '{"score": 75, "feedback": "Great job on this submission! Keep practicing."}');
    
    return {
      score: Math.max(1, Math.min(100, result.score)),
      feedback: result.feedback
    };
  } catch (error) {
    console.error('AI evaluation error:', error);
    return {
      score: 75,
      feedback: "Thank you for your submission! Keep up the great work practicing your cooking skills."
    };
  }
}

async function updateUserProgress(userId: string, classId: string, xpGained: number): Promise<void> {
  try {
    const classDetails = await db
      .select()
      .from(cookingClasses)
      .where(eq(cookingClasses.id, classId))
      .limit(1);

    if (!classDetails.length) return;

    const track = classDetails[0].track;

    const currentProgress = await db
      .select()
      .from(cookingClassProgress)
      .where(and(
        eq(cookingClassProgress.userId, userId),
        eq(cookingClassProgress.track, track)
      ))
      .limit(1);

    if (!currentProgress.length) {
      await db
        .insert(cookingClassProgress)
        .values({
          userId,
          track,
          completedClasses: [classId],
          currentModule: classDetails[0].module,
          skillBadges: xpGained >= 80 ? ['high_performer'] : [],
          totalXp: xpGained
        });
    } else {
      const progress = currentProgress[0];
      const completedClasses = Array.isArray(progress.completedClasses) ? progress.completedClasses : [];
      
      if (!completedClasses.includes(classId)) {
        completedClasses.push(classId);
      }

      const newBadges = [...(progress.skillBadges || [])];
      if (xpGained >= 90 && !newBadges.includes('excellence')) {
        newBadges.push('excellence');
      }
      if (completedClasses.length >= 5 && !newBadges.includes('dedicated_learner')) {
        newBadges.push('dedicated_learner');
      }

      await db
        .update(cookingClassProgress)
        .set({
          completedClasses,
          skillBadges: newBadges,
          totalXp: (progress.totalXp || 0) + xpGained,
          lastActive: sql`now()`
        })
        .where(eq(cookingClassProgress.id, progress.id));
    }
  } catch (error) {
    console.error('Error updating user progress:', error);
  }
}

export default router;
