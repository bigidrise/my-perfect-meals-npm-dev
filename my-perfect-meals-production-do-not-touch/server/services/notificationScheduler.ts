// server/services/notificationScheduler.ts
import { sendSMS, isSMSServiceAvailable } from '../smsService';
import { scheduleSmsAt } from './sms';

export async function scheduleMealReminder(userId: string, dateISO: string, timeHHMM: string, text: string) {
  console.log(`[notify] ${userId} @ ${dateISO} ${timeHHMM} → ${text}`);
  
  // Check if SMS service is available
  if (!isSMSServiceAvailable()) {
    console.log('⚠️ SMS service not available - skipping meal reminder notification');
    return false;
  }

  // For immediate notifications, send directly
  const now = new Date();
  const scheduledTime = new Date(dateISO + 'T' + timeHHMM);
  
  if (scheduledTime <= now) {
    console.log('📱 Sending immediate meal reminder SMS');
    return await sendSMS('+1234567890', text); // TODO: Get user's phone from SMS settings
  }
  
  // For future notifications, schedule using the SMS queue
  try {
    const jobId = await scheduleSmsAt(scheduledTime.toISOString(), {
      userId,
      toE164: '+1234567890', // TODO: Get user's phone from SMS settings
      body: text,
      reminderId: null // Will be set when creating meal reminders
    });
    
    console.log(`✅ Meal reminder SMS scheduled with job ID: ${jobId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to schedule meal reminder SMS:', error);
    return false;
  }
}