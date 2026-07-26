import express from 'express';
import { db } from '../db';
import { 
  learnToCookChallenges,
  learnToCookEntries,
  learnToCookVotes,
  userBadges,
  insertLearnToCookEntrySchema,
  insertLearnToCookVoteSchema
} from '../../shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { learnToCookService } from '../services/learnToCookService';
import { requireAuth } from '../middleware/requireAuth';
import type { AuthenticatedRequest } from '../middleware/requireAuth';

const router = express.Router();

// Auth identity must be established first inside this router.
// See: express-async-subrouter-bug — Express v4 does not await async middleware
// in app.use(path, asyncFn, router). requireAuth inside the router guarantees
// req.authUser is set before any handler runs.
router.use(requireAuth);

// Get current active challenge
router.get('/current', async (req, res) => {
  try {
    await learnToCookService.ensureMonthlyChallenge();
    
    const currentChallenge = await learnToCookService.getCurrentChallenge();
    
    if (!currentChallenge) {
      return res.status(404).json({ error: 'No active challenge found' });
    }

    const entries = await learnToCookService.getChallengeEntries(currentChallenge.id);
    
    res.json({ 
      challenge: currentChallenge,
      entries,
      entriesCount: entries.length
    });
  } catch (error) {
    console.error('Error fetching current challenge:', error);
    res.status(500).json({ error: 'Failed to fetch current challenge' });
  }
});

// Submit entry to current challenge
router.post('/current/submit', async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const currentChallenge = await learnToCookService.getCurrentChallenge();
    
    if (!currentChallenge) {
      return res.status(404).json({ error: 'No active challenge found' });
    }

    if (currentChallenge.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Challenge is not accepting entries' });
    }

    const existingEntry = await db
      .select()
      .from(learnToCookEntries)
      .where(
        and(
          eq(learnToCookEntries.challengeId, currentChallenge.id),
          eq(learnToCookEntries.userId, userId)
        )
      );

    if (existingEntry.length > 0) {
      return res.status(400).json({ error: 'User has already submitted to this challenge' });
    }

    const entryData = insertLearnToCookEntrySchema.parse({
      ...req.body,
      userId,
      challengeId: currentChallenge.id
    });

    const [entry] = await db
      .insert(learnToCookEntries)
      .values(entryData as any)
      .returning();

    res.json({ entry, message: 'Entry submitted successfully!' });
  } catch (error) {
    console.error('Error submitting entry:', error);
    res.status(500).json({ error: 'Failed to submit entry' });
  }
});

// Vote on an entry
router.post('/entries/:entryId/vote', async (req, res) => {
  try {
    const { entryId } = req.params;
    const userId = (req as AuthenticatedRequest).authUser.id;

    const [entry] = await db
      .select()
      .from(learnToCookEntries)
      .where(eq(learnToCookEntries.id, entryId));

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.userId === userId) {
      return res.status(400).json({ error: 'Cannot vote for your own entry' });
    }

    const [challenge] = await db
      .select()
      .from(learnToCookChallenges)
      .where(eq(learnToCookChallenges.id, entry.challengeId));

    if (!challenge || challenge.status !== 'VOTING') {
      return res.status(400).json({ error: 'Challenge is not in voting phase' });
    }

    const existingVote = await db
      .select()
      .from(learnToCookVotes)
      .where(
        and(
          eq(learnToCookVotes.entryId, entryId),
          eq(learnToCookVotes.voterUserId, userId)
        )
      );

    if (existingVote.length > 0) {
      return res.status(400).json({ error: 'Already voted for this entry' });
    }

    await db
      .insert(learnToCookVotes)
      .values({
        challengeId: entry.challengeId,
        entryId,
        voterUserId: userId
      });

    res.json({ message: 'Vote submitted successfully!' });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// Get challenge history
router.get('/history', async (req, res) => {
  try {
    const challenges = await db
      .select()
      .from(learnToCookChallenges)
      .orderBy(desc(learnToCookChallenges.createdAt))
      .limit(12);

    const challengesWithStats = await Promise.all(
      challenges.map(async (challenge) => {
        const entries = await learnToCookService.getChallengeEntries(challenge.id);
        return {
          ...challenge,
          entriesCount: entries.length,
          winner: entries.length > 0 ? entries[0] : null
        };
      })
    );

    res.json({ challenges: challengesWithStats });
  } catch (error) {
    console.error('Error fetching challenge history:', error);
    res.status(500).json({ error: 'Failed to fetch challenge history' });
  }
});

// Get user badges — scoped to the authenticated user's own badges
router.get('/user/:userId/badges', async (req, res) => {
  try {
    const authUserId = (req as AuthenticatedRequest).authUser.id;
    const { userId } = req.params;

    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const badges = await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, authUserId))
      .orderBy(desc(userBadges.createdAt));

    res.json({ badges });
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ error: 'Failed to fetch user badges' });
  }
});

// Admin: Update challenge statuses
router.post('/admin/update-statuses', async (req, res) => {
  try {
    await learnToCookService.updateChallengeStatuses();
    res.json({ message: 'Challenge statuses updated successfully' });
  } catch (error) {
    console.error('Error updating challenge statuses:', error);
    res.status(500).json({ error: 'Failed to update challenge statuses' });
  }
});

// Admin: Generate monthly challenge
router.post('/admin/generate-monthly', async (req, res) => {
  try {
    const challengeId = await learnToCookService.ensureMonthlyChallenge();
    const challenge = await db
      .select()
      .from(learnToCookChallenges)
      .where(eq(learnToCookChallenges.id, challengeId))
      .limit(1);

    res.json({ 
      message: 'Monthly challenge generated successfully',
      challenge: challenge[0]
    });
  } catch (error) {
    console.error('Error generating monthly challenge:', error);
    res.status(500).json({ error: 'Failed to generate monthly challenge' });
  }
});

export default router;
