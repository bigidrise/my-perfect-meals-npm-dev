import { db } from './db';
import { contests, contestEntries } from '../shared/schema';
import { eq, and, gte, lte, count } from 'drizzle-orm';

export interface ConciergeReminder {
  id: string;
  type: 'contest-submission' | 'contest-voting' | 'contest-deadline' | 'weigh-in' | 'meal-log';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  dueDate?: string;
  isUrgent: boolean;
}

export class ConciergeService {
  async getPersonalizedReminders(userId: string): Promise<ConciergeReminder[]> {
    const reminders: ConciergeReminder[] = [];
    
    try {
      // Check for active contests
      await this.addContestReminders(userId, reminders);
      
      // Add other reminder types here (weigh-in, meal logging, etc.)
      await this.addHealthReminders(userId, reminders);
      
      return reminders.sort((a, b) => {
        // Sort by priority and urgency
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
    } catch (error) {
      console.error('Error getting personalized reminders:', error);
      return [];
    }
  }

  private async addContestReminders(userId: string, reminders: ConciergeReminder[]) {
    const today = new Date().toISOString();
    
    // Find active contest
    const activeContest = await db.query.contests.findFirst({
      where: and(
        lte(contests.startDate, today),
        gte(contests.endDate, today),
        eq(contests.isActive, true)
      ),
    });

    if (!activeContest) return;

    // Check if user has submitted an entry
    const userEntry = await db.query.contestEntries.findFirst({
      where: and(
        eq(contestEntries.contestId, activeContest.id),
        eq(contestEntries.userId, userId)
      ),
    });

    const endDate = new Date(activeContest.endDate);
    const daysUntilDeadline = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    if (!userEntry) {
      // User hasn't submitted - remind them to participate
      const isUrgent = daysUntilDeadline <= 3;
      const priority = isUrgent ? 'high' : daysUntilDeadline <= 7 ? 'medium' : 'low';

      reminders.push({
        id: `contest-submit-${activeContest.id}`,
        type: 'contest-submission',
        title: `🏆 ${activeContest.title}`,
        message: isUrgent 
          ? `Only ${daysUntilDeadline} days left to submit your recipe!`
          : `Join the cooking contest! Show off your culinary skills.`,
        priority,
        actionUrl: '/learn-to-cook',
        dueDate: activeContest.endDate,
        isUrgent
      });
    } else {
      // User has submitted - remind them to vote for others
      const totalEntries = await db
        .select({ count: count() })
        .from(contestEntries)
        .where(eq(contestEntries.contestId, activeContest.id));

      if (totalEntries[0]?.count > 1) {
        reminders.push({
          id: `contest-vote-${activeContest.id}`,
          type: 'contest-voting',
          title: '🗳️ Vote for Contest Entries',
          message: `Check out other amazing recipes and vote for your favorites!`,
          priority: 'medium',
          actionUrl: '/learn-to-cook',
          dueDate: activeContest.endDate,
          isUrgent: daysUntilDeadline <= 2
        });
      }
    }

    // Contest deadline reminder
    if (daysUntilDeadline <= 1) {
      reminders.push({
        id: `contest-deadline-${activeContest.id}`,
        type: 'contest-deadline',
        title: '⏰ Contest Deadline Approaching',
        message: `Contest submissions close ${daysUntilDeadline === 0 ? 'today' : 'tomorrow'}!`,
        priority: 'high',
        actionUrl: '/learn-to-cook',
        dueDate: activeContest.endDate,
        isUrgent: true
      });
    }
  }

  private async addHealthReminders(userId: string, reminders: ConciergeReminder[]) {
    // Mock health reminders - in real implementation, this would check user's actual data
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    // Weekly weigh-in reminder (Mondays)
    if (dayOfWeek === 1) {
      reminders.push({
        id: 'weekly-weigh-in',
        type: 'weigh-in',
        title: '⚖️ Weekly Check-in',
        message: "Time for your weekly weigh-in! Track your progress.",
        priority: 'medium',
        actionUrl: '/my-biometrics',
        isUrgent: false
      });
    }

    // Meal logging reminder (if no recent logs)
    const hour = now.getHours();
    if (hour >= 12 && hour <= 14) { // Lunch time
      reminders.push({
        id: 'lunch-log-reminder',
        type: 'meal-log',
        title: '🍽️ Log Your Lunch',
        message: "Don't forget to log your lunch for better nutrition tracking!",
        priority: 'low',
        actionUrl: '/log-meals',
        isUrgent: false
      });
    }
  }

  async getConciergeVoicePrompts(userId: string): Promise<string[]> {
    const reminders = await this.getPersonalizedReminders(userId);
    
    return reminders
      .filter(r => r.priority === 'high' || r.isUrgent)
      .slice(0, 3) // Limit to top 3 most important
      .map(r => {
        switch (r.type) {
          case 'contest-submission':
            return `Hey! I noticed you haven't entered this month's cooking contest yet. The theme is healthy comfort food, and there are only a few days left to submit. Want to show off your culinary skills?`;
          case 'contest-voting':
            return `The contest entries look amazing this month! Have you had a chance to vote for your favorites yet? Your vote helps crown the winner.`;
          case 'contest-deadline':
            return `Just a friendly reminder that the cooking contest submissions close very soon. Don't miss your chance to participate!`;
          case 'weigh-in':
            return `It's Monday - perfect time for your weekly check-in! How are you feeling about tracking your progress today?`;
          case 'meal-log':
            return `I see it's lunch time! Remember to log your meal so we can keep track of your nutrition goals together.`;
          default:
            return r.message;
        }
      });
  }
}

export const conciergeService = new ConciergeService();