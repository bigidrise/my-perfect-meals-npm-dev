import { Resend } from 'resend';

const EMAIL_FROM = 'My Perfect Meals <noreply@mail.myperfectmeals.com>';

let resend: Resend | null = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✅ Resend email service initialized');
} else {
  console.log('⚠️ RESEND_API_KEY not found - Care Team invites disabled');
}

export async function sendPasswordResetEmail({
  to,
  resetLink,
  userName,
}: {
  to: string;
  resetLink: string;
  userName: string;
}) {
  if (!resend) {
    console.log('⚠️ Resend service not available - skipping password reset email');
    return null;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: 'Reset your My Perfect Meals password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; font-size: 22px; margin-top: 0;">Hi ${userName},</h2>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password for My Perfect Meals. Click the button below to choose a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background: #6d28d9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
                <strong>Important:</strong> This link will expire in 30 minutes for security reasons.
              </p>
            </div>
            
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            
            <div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; word-break: break-all; font-family: monospace; font-size: 12px; color: #6b7280;">
              ${resetLink}
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
            </p>
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 0;">
              My Perfect Meals - Personalized Nutrition & Meal Planning
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('✅ Password reset email sent:', data?.id);
    return data;
  } catch (error) {
    console.error('❌ Email service error:', error);
    throw error;
  }
}

export async function sendCareTeamInvite({
  to,
  patientName,
  inviteCode,
  role,
}: {
  to: string;
  patientName: string;
  inviteCode: string;
  role: string;
}) {
  if (!resend) {
    console.log('⚠️ Resend service not available - skipping Care Team invite email');
    return null;
  }

  const isClinic = ['doctor', 'physician', 'pa', 'np', 'rn'].includes(role);
  const proLabel = isClinic ? 'doctor' : 'trainer';
  const spaceLabel = isClinic ? 'clinic' : 'studio';
  const subjectLine = isClinic
    ? "You've been invited to your doctor's ProCare clinic"
    : "You've been invited to your trainer's ProCare studio";
  const bodyText = isClinic
    ? 'ProCare is a secure system your doctor uses to support your nutrition, health goals, and care plan.'
    : 'ProCare is the system your trainer uses to guide your nutrition, training support, and progress.';
  const ctaText = isClinic ? 'Join ProCare Clinic' : 'Join ProCare Studio';

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: subjectLine,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${ctaText}</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Your ${proLabel} has invited you to join their ProCare ${spaceLabel}.
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              ${bodyText}
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              <strong>Your invitation code:</strong>
            </p>
            
            <div style="background: #f3f4f6; border: 2px solid #6d28d9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; color: #6d28d9; letter-spacing: 2px; font-family: monospace;">
                ${inviteCode}
              </div>
            </div>
            
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #1e40af; font-size: 14px; margin: 0; line-height: 1.6;">
                <strong>To accept this invitation:</strong><br>
                1. Log into My Perfect Meals<br>
                2. Go to the <strong>More</strong> tab<br>
                3. Enter the code under <strong>Connect with Access Code</strong><br>
                4. Tap <strong>Connect</strong>
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              This invitation expires in 7 days.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 0;">
              My Perfect Meals - Personalized Nutrition & Meal Planning
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('✅ Care Team invite email sent:', data?.id);
    return data;
  } catch (error) {
    console.error('❌ Email service error:', error);
    throw error;
  }
}
