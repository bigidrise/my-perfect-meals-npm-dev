import twilio from 'twilio';

// Initialize Twilio if credentials are available
let twilioClient: twilio.Twilio | null = null;
let twilioPhoneNumber: string | null = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  console.log('✅ Twilio SMS service initialized');
} else {
  console.log('⚠️ Twilio credentials not found - SMS notifications disabled');
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.log('📱 SMS service not available - skipping SMS notification');
    return false;
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to
    });

    console.log(`✅ SMS sent successfully, SID: ${result.sid}`);
    return true;
  } catch (error) {
    console.error('❌ Twilio SMS error:', error);
    return false;
  }
}

export function isSMSServiceAvailable(): boolean {
  return twilioClient !== null && twilioPhoneNumber !== null;
}