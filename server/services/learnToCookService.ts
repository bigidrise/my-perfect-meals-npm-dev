import OpenAI from 'openai';
import { db } from '../db';
import { learnToCookChallenges, learnToCookEntries, learnToCookVotes, userBadges } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { format, addDays, setDate, setHours, setMinutes, setSeconds } from 'date-fns';

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

class LearnToCookService {
  async generateMonthlyChallenge(monthKey: string): Promise<{ title: string; prompt: string }> {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a cooking competition organizer. Generate creative monthly cooking challenges. Respond with JSON: {"title": "Challenge Title", "prompt": "Full challenge description"}'
          },
          {
            role: 'user',
            content: `Generate a fun, inclusive cooking challenge for ${monthKey}. Make it accessible to home cooks of all skill levels.`
          }
        ]
      });

      const result = JSON.parse(response.choices[0].message.content!);
      return {
        title: result.title,
        prompt: result.prompt
      };
    } catch (error) {
      console.error('AI challenge generation failed:', error);
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

  async ensureMonthlyChallenge(timezone = 'America/Chicago'): Promise<string> {
    const now = new Date();
    const monthKey = format(now, 'yyyy-MM');
    
    const existing = await db
      .select()
      .from(learnToCookChallenges)
      .where(eq(learnToCookChallenges.monthKey, monthKey))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    const { title, prompt } = await this.generateMonthlyChallenge(monthKey);
    
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

  async updateChallengeStatuses(): Promise<void> {
    const now = new Date();

    await db
      .update(learnToCookChallenges)
      .set({ status: 'VOTING' })
      .where(
        and(
          eq(learnToCookChallenges.status, 'ACTIVE'),
          sql`${learnToCookChallenges.entryDeadline} < ${now}`
        )
      );

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

  async closeChallenge(challengeId: string): Promise<void> {
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

    for (let i = 0; i < entryVotes.length; i++) {
      const entry = entryVotes[i];
      if (!entry.userId) continue;

      if (i === 0 && entry.voteCount > 0) {
        await db.insert(userBadges).values({
          userId: entry.userId,
          badgeType: 'CHEF_OF_MONTH',
          meta: { monthKey, place: 1, challengeId }
        }).onConflictDoNothing();
      }

      await db.insert(userBadges).values({
        userId: entry.userId,
        badgeType: 'CHALLENGE_FINISHER',
        meta: { monthKey, challengeId }
      }).onConflictDoNothing();
    }

    await db
      .update(learnToCookChallenges)
      .set({ status: 'CLOSED' })
      .where(eq(learnToCookChallenges.id, challengeId));

    console.log(`✅ Closed challenge ${challengeId}, awarded ${entryVotes.length} badges`);
  }

  async getCurrentChallenge() {
    const [challenge] = await db
      .select()
      .from(learnToCookChallenges)
      .where(eq(learnToCookChallenges.status, 'ACTIVE'))
      .orderBy(desc(learnToCookChallenges.createdAt))
      .limit(1);

    return challenge || null;
  }

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
