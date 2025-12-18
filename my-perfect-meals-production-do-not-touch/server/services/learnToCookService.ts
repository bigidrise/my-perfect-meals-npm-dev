import OpenAI from 'openai';
import { db } from '../db';
import { learnToCookChallenges, learnToCookEntries, learnToCookVotes, userBadges } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { format, addDays, setDate, setHours, setMinutes, setSeconds } from 'date-fns';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI Challenge Generation Prompts
const CHALLENGE_THEMES = [
  'Comfort Food Classics',
  'International Cuisine Adventure', 
  'Healthy & Fresh',
  'Dessert Mastery',
  'Breakfast & Brunch',
  'One-Pot Wonders',
  'Seasonal Ingredients',
  'Plant-Based Creations',
  'Quick & Easy Weeknight',
  'Holiday & Celebration',
  'Fusion Cuisine',
  'Artisan Bread & Baking'
];

export class LearnToCookService {
  /**
   * Generate AI-powered monthly challenge
   * Creates varied, engaging challenges with specific requirements
   */
  async generateMonthlyChallenge(monthKey: string): Promise<{ title: string; prompt: string }> {
    try {
      const theme = CHALLENGE_THEMES[Math.floor(Math.random() * CHALLENGE_THEMES.length)];
      
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are a creative culinary challenge designer. Create engaging monthly cooking challenges that inspire home cooks to learn new techniques and explore flavors. Focus on skill-building and creativity.`
          },
          {
            role: "user",
            content: `Create a "${theme}" cooking challenge for ${monthKey}. Include:
            
            1. A catchy, inspiring title (max 60 chars)
            2. Clear, specific requirements (techniques, ingredients, or style)
            3. Skill level guidance (beginner-friendly but with room for creativity)
            4. What makes a winning entry
            
            Format as JSON: {"title": "...", "prompt": "..."}
            
            Example themes: comfort food with a twist, fusion cuisine, seasonal ingredients, healthy makeovers, etc.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8
      });

      const result = JSON.parse(response.choices[0].message.content!);
      return {
        title: result.title,
        prompt: result.prompt
      };
    } catch (error) {
      console.error('AI challenge generation failed:', error);
      // Fallback to predetermined challenges
      const fallbacks = [
        {
          title: "Comfort Food with a Twist",
          prompt: "Take a classic comfort food dish and give it your unique twist! Whether it's healthier ingredients, international flavors, or creative presentation - show us how you reimagine a beloved favorite. Judges will look for creativity, flavor balance, and visual appeal."
        },
        {
          title: "One-Bowl Wonder",
          prompt: "Create a complete, satisfying meal that can be made and served in just one bowl! Focus on balanced nutrition, bold flavors, and beautiful presentation. Think grain bowls, hearty soups, pasta dishes, or creative salads that tell a story."
        }
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  /**
   * Ensure monthly challenge exists - creates if missing
   * Called by cron job on the 1st of each month
   */
  async ensureMonthlyChallenge(timezone = 'America/Chicago'): Promise<string> {
    const now = new Date();
    const monthKey = format(now, 'yyyy-MM');
    
    // Check if challenge already exists
    const existing = await db
      .select()
      .from(learnToCookChallenges)
      .where(eq(learnToCookChallenges.monthKey, monthKey))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Generate new challenge
    const { title, prompt } = await this.generateMonthlyChallenge(monthKey);
    
    // Calculate deadlines (21 days for entry, 28 days for voting)
    const firstOfMonth = setDate(now, 1);
    const entryDeadline = setSeconds(setMinutes(setHours(addDays(firstOfMonth, 21), 23), 59), 59);
    const voteDeadline = setSeconds(setMinutes(setHours(addDays(firstOfMonth, 28), 23), 59), 59);

    const [challenge] = await db
      .insert(learnToCookChallenges)
      .values({
        monthKey,
        title,
        prompt,
        status: 'ACTIVE',
        entryDeadline,
        voteDeadline
      })
      .returning();

    console.log(`✅ Created monthly challenge: ${title} (${monthKey})`);
    return challenge.id;
  }

  /**
   * Update challenge statuses based on current time
   * Called nightly to transition between phases
   */
  async updateChallengeStatuses(): Promise<void> {
    const now = new Date();

    // Move ACTIVE challenges to VOTING if entry deadline passed
    await db
      .update(learnToCookChallenges)
      .set({ status: 'VOTING' })
      .where(
        and(
          eq(learnToCookChallenges.status, 'ACTIVE'),
          sql`${learnToCookChallenges.entryDeadline} < ${now}`
        )
      );

    // Move VOTING challenges to CLOSED if vote deadline passed
    const closingChallenges = await db
      .select()
      .from(learnToCookChallenges)
      .where(
        and(
          eq(learnToCookChallenges.status, 'VOTING'),
          sql`${learnToCookChallenges.voteDeadline} < ${now}`
        )
      );

    for (const challenge of closingChallenges) {
      await this.closeChallenge(challenge.id);
    }
  }

  /**
   * Close challenge and award badges
   */
  async closeChallenge(challengeId: string): Promise<void> {
    // Get all entries with vote counts
    const entryVotes = await db
      .select({
        entryId: learnToCookEntries.id,
        userId: learnToCookEntries.userId,
        title: learnToCookEntries.title,
        createdAt: learnToCookEntries.createdAt,
        voteCount: sql<number>`count(${learnToCookVotes.id})`.as('voteCount')
      })
      .from(learnToCookEntries)
      .leftJoin(learnToCookVotes, eq(learnToCookVotes.entryId, learnToCookEntries.id))
      .where(eq(learnToCookEntries.challengeId, challengeId))
      .groupBy(learnToCookEntries.id, learnToCookEntries.userId, learnToCookEntries.title, learnToCookEntries.createdAt)
      .orderBy(desc(sql`count(${learnToCookVotes.id})`), learnToCookEntries.createdAt);

    const challenge = await db
      .select()
      .from(learnToCookChallenges)
      .where(eq(learnToCookChallenges.id, challengeId))
      .limit(1);

    if (challenge.length === 0) return;

    const monthKey = challenge[0].monthKey;

    // Award badges
    for (let i = 0; i < entryVotes.length; i++) {
      const entry = entryVotes[i];
      if (!entry.userId) continue;

      // Chef of the Month for winner
      if (i === 0 && entry.voteCount > 0) {
        await db.insert(userBadges).values({
          userId: entry.userId,
          badgeType: 'CHEF_OF_MONTH',
          meta: { monthKey, place: 1, challengeId }
        }).onConflictDoNothing();
      }

      // Challenge Finisher for all participants
      await db.insert(userBadges).values({
        userId: entry.userId,
        badgeType: 'CHALLENGE_FINISHER',
        meta: { monthKey, challengeId }
      }).onConflictDoNothing();
    }

    // Mark challenge as closed
    await db
      .update(learnToCookChallenges)
      .set({ status: 'CLOSED' })
      .where(eq(learnToCookChallenges.id, challengeId));

    console.log(`✅ Closed challenge ${challengeId}, awarded ${entryVotes.length} badges`);
  }

  /**
   * Get current active challenge
   */
  async getCurrentChallenge() {
    const [challenge] = await db
      .select()
      .from(learnToCookChallenges)
      .where(eq(learnToCookChallenges.status, 'ACTIVE'))
      .orderBy(desc(learnToCookChallenges.createdAt))
      .limit(1);

    return challenge || null;
  }

  /**
   * Get challenge entries with vote counts
   */
  async getChallengeEntries(challengeId: string) {
    return await db
      .select({
        id: learnToCookEntries.id,
        challengeId: learnToCookEntries.challengeId,
        userId: learnToCookEntries.userId,
        title: learnToCookEntries.title,
        imageUrl: learnToCookEntries.imageUrl,
        blurb: learnToCookEntries.blurb,
        cookingUrl: learnToCookEntries.cookingUrl,
        createdAt: learnToCookEntries.createdAt,
        voteCount: sql<number>`count(${learnToCookVotes.id})`.as('voteCount')
      })
      .from(learnToCookEntries)
      .leftJoin(learnToCookVotes, eq(learnToCookVotes.entryId, learnToCookEntries.id))
      .where(eq(learnToCookEntries.challengeId, challengeId))
      .groupBy(
        learnToCookEntries.id,
        learnToCookEntries.challengeId,
        learnToCookEntries.userId,
        learnToCookEntries.title,
        learnToCookEntries.imageUrl,
        learnToCookEntries.blurb,
        learnToCookEntries.cookingUrl,
        learnToCookEntries.createdAt
      )
      .orderBy(desc(sql`count(${learnToCookVotes.id})`), learnToCookEntries.createdAt);
  }
}

export const learnToCookService = new LearnToCookService();