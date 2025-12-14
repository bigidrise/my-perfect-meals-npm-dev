import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { contests, contestEntries, contestVotes, insertContestSchema, insertContestEntrySchema, insertContestVoteSchema } from '../../shared/schema';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { conciergeService } from '../conciergeService';

const router = express.Router();

// Create new contest
router.post('/create-contest', async (req, res) => {
  try {
    const data = insertContestSchema.parse(req.body);
    const [contest] = await db.insert(contests).values({
      ...data,
      createdAt: new Date().toISOString(),
    }).returning();
    res.status(201).json({ message: 'Contest created successfully', contest });
  } catch (err) {
    res.status(400).json({ error: 'Invalid contest data', details: err });
  }
});

// Get active contest
router.get('/active-contest', async (req, res) => {
  try {
    const today = new Date().toISOString();
    const contest = await db.query.contests.findFirst({
      where: and(
        lte(contests.startDate, today),
        gte(contests.endDate, today),
        eq(contests.isActive, true)
      ),
    });
    res.json(contest || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active contest', details: err });
  }
});

// Submit contest entry
router.post('/submit-contest-entry', async (req, res) => {
  try {
    const data = insertContestEntrySchema.parse(req.body);
    
    // Check if contest exists and is active
    const contest = await db.query.contests.findFirst({
      where: eq(contests.id, data.contestId),
    });
    
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    
    const today = new Date().toISOString();
    if (contest.startDate > today || contest.endDate < today) {
      return res.status(400).json({ error: 'Contest is not currently active' });
    }
    
    // Check if user already submitted
    const existingEntry = await db.query.contestEntries.findFirst({
      where: and(
        eq(contestEntries.contestId, data.contestId),
        eq(contestEntries.userId, data.userId)
      ),
    });
    
    if (existingEntry) {
      return res.status(400).json({ error: 'You have already submitted an entry for this contest' });
    }
    
    const [entry] = await db.insert(contestEntries).values(data).returning();
    res.status(201).json({ message: 'Entry submitted successfully', entry });
  } catch (err) {
    res.status(400).json({ error: 'Invalid entry data', details: err });
  }
});

// Get contest entries
router.get('/contest-entries/:contestId', async (req, res) => {
  try {
    const { contestId } = req.params;
    const entries = await db.query.contestEntries.findMany({
      where: eq(contestEntries.contestId, contestId),
      orderBy: [desc(contestEntries.submittedAt)],
    });
    
    // Get vote counts for each entry
    const entriesWithVotes = await Promise.all(
      entries.map(async (entry) => {
        const voteCount = await db
          .select({ count: count() })
          .from(contestVotes)
          .where(eq(contestVotes.entryId, entry.id));
        
        return {
          ...entry,
          voteCount: voteCount[0]?.count || 0,
        };
      })
    );
    
    res.json(entriesWithVotes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contest entries', details: err });
  }
});

// Vote for contest entry
router.post('/vote-contest-entry', async (req, res) => {
  try {
    const data = insertContestVoteSchema.parse(req.body);
    
    // Check if user already voted for this entry
    const existingVote = await db.query.contestVotes.findFirst({
      where: and(
        eq(contestVotes.contestId, data.contestId),
        eq(contestVotes.entryId, data.entryId),
        eq(contestVotes.userId, data.userId)
      ),
    });
    
    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted for this entry' });
    }
    
    // Check if contest is still active for voting
    const contest = await db.query.contests.findFirst({
      where: eq(contests.id, data.contestId),
    });
    
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    
    const today = new Date().toISOString();
    if (contest.endDate < today) {
      return res.status(400).json({ error: 'Voting period has ended' });
    }
    
    const [vote] = await db.insert(contestVotes).values(data).returning();
    res.status(201).json({ message: 'Vote submitted successfully', vote });
  } catch (err) {
    res.status(400).json({ error: 'Invalid vote data', details: err });
  }
});

// Get contest winner (entry with most votes)
router.get('/contest-winner/:contestId', async (req, res) => {
  try {
    const { contestId } = req.params;
    
    // Get all entries with vote counts
    const entries = await db.query.contestEntries.findMany({
      where: eq(contestEntries.contestId, contestId),
    });
    
    if (entries.length === 0) {
      return res.json(null);
    }
    
    const entriesWithVotes = await Promise.all(
      entries.map(async (entry) => {
        const voteCount = await db
          .select({ count: count() })
          .from(contestVotes)
          .where(eq(contestVotes.entryId, entry.id));
        
        return {
          ...entry,
          voteCount: voteCount[0]?.count || 0,
        };
      })
    );
    
    // Find winner (entry with most votes)
    const winner = entriesWithVotes.reduce((prev, current) => 
      (current.voteCount > prev.voteCount) ? current : prev
    );
    
    res.json(winner);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contest winner', details: err });
  }
});

// Get user's contest participation status
router.get('/user-contest-status/:contestId/:userId', async (req, res) => {
  try {
    const { contestId, userId } = req.params;
    
    // Check if user has submitted an entry
    const entry = await db.query.contestEntries.findFirst({
      where: and(
        eq(contestEntries.contestId, contestId),
        eq(contestEntries.userId, userId)
      ),
    });
    
    // Get how many entries user has voted for
    const votesCount = await db
      .select({ count: count() })
      .from(contestVotes)
      .where(and(
        eq(contestVotes.contestId, contestId),
        eq(contestVotes.userId, userId)
      ));
    
    res.json({
      hasSubmitted: !!entry,
      submittedEntry: entry || null,
      votesCount: votesCount[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user contest status', details: err });
  }
});

// Get personalized concierge reminders for a user
router.get('/reminders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const reminders = await conciergeService.getPersonalizedReminders(userId);
    res.json(reminders);
  } catch (error) {
    console.error('Error getting concierge reminders:', error);
    res.status(500).json({ error: 'Failed to get reminders' });
  }
});

// Get voice prompts for concierge assistant
router.get('/voice-prompts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const prompts = await conciergeService.getConciergeVoicePrompts(userId);
    res.json(prompts);
  } catch (error) {
    console.error('Error getting voice prompts:', error);
    res.status(500).json({ error: 'Failed to get voice prompts' });
  }
});

// Admin endpoint to seed contest data (for development/testing)
router.post('/seed-contest', async (req, res) => {
  try {
    const { seedJanuaryContest, createTestContestEntries } = await import('../contestSeeder');
    
    // Create the contest
    const contest = await seedJanuaryContest();
    
    // Optionally create test entries
    if (req.body.includeTestEntries) {
      await createTestContestEntries();
    }
    
    res.json({ 
      message: 'Contest seeded successfully', 
      contest,
      testEntriesCreated: !!req.body.includeTestEntries
    });
  } catch (error) {
    console.error('Error seeding contest:', error);
    res.status(500).json({ error: 'Failed to seed contest data' });
  }
});

export default router;