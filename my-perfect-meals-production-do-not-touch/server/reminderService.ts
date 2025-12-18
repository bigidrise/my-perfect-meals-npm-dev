import * as cron from 'node-cron';
import { db } from './db';
import { mealReminders } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
// Note: Email and SMS services will be imported when available

interface ScheduledReminder {
  id: string;
  cronJob: cron.ScheduledTask;
}

class ReminderService {
  private scheduledReminders: Map<string, ScheduledReminder> = new Map();

  async scheduleReminder(reminderId: string) {
    try {
      const [reminder] = await db
        .select()
        .from(mealReminders)
        .where(eq(mealReminders.id, reminderId));

      if (!reminder || !reminder.reminderEnabled || !reminder.isActive) {
        return;
      }

      // Parse scheduled time (format: "HH:MM")
      const [hours, minutes] = reminder.scheduledTime.split(':').map(Number);
      
      // Create cron expression based on whether it's a weekly reminder
      let cronExpression: string;
      
      if (reminder.dayOfWeek !== null) {
        // Weekly reminder: minute hour * * dayOfWeek
        cronExpression = `${minutes} ${hours} * * ${reminder.dayOfWeek}`;
      } else {
        // Daily reminder: minute hour * * *
        cronExpression = `${minutes} ${hours} * * *`;
      }

      console.log(`Scheduling reminder ${reminderId} with cron: ${cronExpression}`);

      const task = cron.schedule(cronExpression, async () => {
        await this.sendReminder(reminderId);
      }, {
        timezone: reminder.timezone || 'UTC'
      });

      this.scheduledReminders.set(reminderId, {
        id: reminderId,
        cronJob: task
      });

      task.start();
      console.log(`Reminder ${reminderId} scheduled successfully`);

    } catch (error) {
      console.error(`Error scheduling reminder ${reminderId}:`, error);
    }
  }

  async sendReminder(reminderId: string) {
    try {
      const [reminder] = await db
        .select()
        .from(mealReminders)
        .where(and(
          eq(mealReminders.id, reminderId),
          eq(mealReminders.isActive, true),
          eq(mealReminders.reminderEnabled, true)
        ));

      if (!reminder) {
        console.log(`Reminder ${reminderId} not found or inactive, stopping job`);
        this.cancelReminder(reminderId);
        return;
      }

      // Get user details for notification
      const user = await this.getUserDetails(reminder.userId);
      if (!user) {
        console.error(`User not found for reminder ${reminderId}`);
        return;
      }

      const message = `🍽️ Meal Reminder: Time to prepare your ${reminder.mealType}! 
      
Today's meal: ${reminder.recipeName}

Don't forget to check your meal plan for ingredients and cooking instructions.

Happy cooking! 🧑‍🍳`;

      // For now, just log the reminder - email/SMS integration can be added later
      let notificationSent = true;
      console.log(`📧 Would send reminder to user ${user.email || user.id}:`, message);

      if (notificationSent) {
        // Update last sent timestamp
        await db
          .update(mealReminders)
          .set({ lastSent: new Date() })
          .where(eq(mealReminders.id, reminderId));

        console.log(`Reminder sent successfully for ${reminderId}`);
      } else {
        console.error(`Failed to send reminder for ${reminderId}`);
      }

    } catch (error) {
      console.error(`Error sending reminder ${reminderId}:`, error);
    }
  }

  async getUserDetails(userId: string) {
    try {
      // This would fetch user details from your users table
      // For now, return a mock user
      return {
        id: userId,
        email: 'user@example.com', // Replace with actual user query
        phone: null // Replace with actual user query
      };
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  cancelReminder(reminderId: string) {
    const scheduled = this.scheduledReminders.get(reminderId);
    if (scheduled) {
      scheduled.cronJob.stop();
      scheduled.cronJob.destroy();
      this.scheduledReminders.delete(reminderId);
      console.log(`Reminder ${reminderId} cancelled`);
    }
  }

  async cancelAllUserReminders(userId: string) {
    try {
      const userReminders = await db
        .select()
        .from(mealReminders)
        .where(eq(mealReminders.userId, userId));

      for (const reminder of userReminders) {
        this.cancelReminder(reminder.id);
      }

      // Deactivate in database
      await db
        .update(mealReminders)
        .set({ isActive: false })
        .where(eq(mealReminders.userId, userId));

      console.log(`All reminders cancelled for user ${userId}`);
    } catch (error) {
      console.error(`Error cancelling user reminders:`, error);
    }
  }

  async loadExistingReminders() {
    try {
      const activeReminders = await db
        .select()
        .from(mealReminders)
        .where(and(
          eq(mealReminders.isActive, true),
          eq(mealReminders.reminderEnabled, true)
        ));

      console.log(`Loading ${activeReminders.length} existing reminders`);

      for (const reminder of activeReminders) {
        await this.scheduleReminder(reminder.id);
      }
    } catch (error: any) {
      // Handle missing table gracefully (42P01 is PostgreSQL's "undefined_table" error code)
      if (error?.code === '42P01') {
        console.warn('⚠️ meal_reminders table not found - skipping reminder loading on first boot');
      } else {
        console.error('Error loading existing reminders:', error);
      }
    }
  }

  getScheduledReminders() {
    return Array.from(this.scheduledReminders.values()).map(r => ({
      id: r.id,
      isRunning: r.cronJob.getStatus() === 'scheduled'
    }));
  }
}

export const reminderService = new ReminderService();

// Note: Call reminderService.loadExistingReminders() from server startup
// after database connection is established