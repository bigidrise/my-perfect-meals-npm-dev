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

export async function sendCoachActivationEmail({
  to,
  coachDisplayName,
  appUrl,
}: {
  to: string;
  coachDisplayName: string;
  appUrl: string;
}) {
  if (!resend) {
    console.log('⚠️ Resend service not available - skipping activation email');
    return null;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: `Your coaching program is ready — ${coachDisplayName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #c2410c 0%, #ea580c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Your Program Is Live</h1>
          </div>

          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
              Great news — <strong>${coachDisplayName}</strong> has activated your coaching program on My Perfect Meals.
            </p>

            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Your personalized nutrition journey officially starts now. Log into your account to see your dashboard and connect with your coach.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 16px;">
                Open My Dashboard
              </a>
            </div>

            <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #9a3412; font-size: 14px; margin: 0; line-height: 1.6;">
                <strong>What's next:</strong><br>
                Your coach will be in touch through the messaging system inside the app. Keep an eye on your inbox and notifications.
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 0;">
              My Perfect Meals — Personalized Nutrition &amp; Meal Planning
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Activation email error:', error);
      return null;
    }

    console.log('✅ Coach activation email sent:', data?.id);
    return data;
  } catch (err) {
    console.error('❌ Activation email failed:', err);
    return null;
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

  const APP_URL = 'https://app.myperfectmeals.com';

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: subjectLine,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #000000 0%, #F97316 50%, #000000 100%); padding: 36px 30px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <img src="${APP_URL}/icons/icon-192x192.png" alt="My Perfect Meals" style="width: 64px; height: 64px; border-radius: 16px; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;" />
            <h1 style="color: white; margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: -0.3px;">${ctaText}</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 10px 0 22px; font-size: 15px;">Get started by clicking below:</p>
            <a href="${APP_URL}" style="display: inline-block; background: white; color: #000000; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 50px; text-decoration: none; letter-spacing: 0.3px;">Get Started →</a>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Your ${proLabel} has invited you to join their ProCare ${spaceLabel} on My Perfect Meals.
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              ${bodyText}
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
              <strong>Your Invitation Code:</strong>
            </p>
            
            <div style="background: #fff7ed; border: 2px solid #F97316; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; color: #ea580c; letter-spacing: 4px; font-family: monospace;">
                ${inviteCode}
              </div>
            </div>
            
            <div style="background: #f9fafb; border-left: 4px solid #F97316; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #1c1c1c; font-size: 14px; margin: 0; line-height: 1.8;">
                <strong>To accept this invitation:</strong><br><br>
                1. <strong>Download or open My Perfect Meals</strong><br>
                &nbsp;&nbsp;&nbsp;<a href="${APP_URL}" style="color: #ea580c;">${APP_URL}</a><br><br>
                2. Create your account and complete setup<br><br>
                3. Go to the <strong>More</strong> tab<br><br>
                4. Tap <strong>Connect with Access Code</strong><br><br>
                5. Enter your code and tap <strong>Connect</strong>
              </p>
            </div>

            <div style="background: #fff7ed; border-left: 4px solid #F97316; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #7c2d12; font-size: 14px; margin: 0; line-height: 1.6;">
                <strong>⚠️ Important:</strong> To work with your ${proLabel}, you'll need to activate the <strong>ProCare (Ultimate) plan</strong> during setup.
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

export async function sendCoachingInviteEmail({
  to,
  coachDisplayName,
  inviteToken,
  appUrl,
}: {
  to: string;
  coachDisplayName: string;
  inviteToken: string;
  appUrl: string;
}) {
  if (!resend) {
    console.log('[CoachInvite] Resend not configured — skipping invite email');
    return null;
  }

  const joinUrl = `${appUrl}/apply-guidance?token=${inviteToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: `${coachDisplayName} invited you to start personal coaching`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #c2410c 0%, #ea580c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px;">Personal Coaching Invitation</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">My Perfect Meals</p>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              <strong>${coachDisplayName}</strong> has personally invited you to start a coaching program through My Perfect Meals.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              As their client, you'll get personalized nutrition guidance, meal planning support, and direct in-app access to your coach.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${joinUrl}" style="background: #ea580c; color: white; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                Accept Invitation &amp; Start Program
              </a>
            </div>
            <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">
                A subscription is required to activate your coaching program. Your coach will personally review and activate your program after you sign up.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 24px;">
              This invitation expires in 30 days. If you didn't expect this email, you can safely ignore it.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[CoachInvite] Resend error:', error);
      return null;
    }

    console.log('[CoachInvite] Invite email sent:', data?.id);
    return data;
  } catch (err) {
    console.error('[CoachInvite] Email failed (non-fatal):', err);
    return null;
  }
}
