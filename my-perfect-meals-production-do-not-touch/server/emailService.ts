import { MailService } from '@sendgrid/mail';

// Initialize SendGrid if API key is available
let mailService: MailService | null = null;

if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid email service initialized');
} else {
  console.log('⚠️ SENDGRID_API_KEY not found - email notifications disabled');
}

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!mailService) {
    console.log('📧 Email service not available - skipping email notification');
    return false;
  }

  try {
    const message: any = {
      to: params.to,
      from: params.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@myperfectmeals.com',
      subject: params.subject,
    };
    
    if (params.text) message.text = params.text;
    if (params.html) message.html = params.html;
    
    await mailService.send(message);

    console.log(`✅ Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('❌ SendGrid email error:', error);
    return false;
  }
}

export function isEmailServiceAvailable(): boolean {
  return mailService !== null;
}