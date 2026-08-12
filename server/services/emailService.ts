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

  const APP_URL = process.env.PUBLIC_APP_URL || 'https://app.myperfectmeals.ai';

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
            <a href="${APP_URL}" style="display: inline-block; background: #000000; color: #ffffff; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 50px; text-decoration: none; letter-spacing: 0.3px;">Get Started →</a>
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

export async function sendCoachMessageAlert({
  to,
  coachName,
  clientName,
  messagePreview,
  portalUrl,
}: {
  to: string;
  coachName: string;
  clientName: string;
  messagePreview: string;
  portalUrl: string;
}) {
  if (!resend) {
    console.log('[CoachAlert] Resend not configured — skipping message alert');
    return null;
  }

  const preview = messagePreview.length > 120 ? messagePreview.slice(0, 117) + '...' : messagePreview;

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: `New message from ${clientName} — My Perfect Meals`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #000000 0%, #F97316 50%, #000000 100%); padding: 32px 24px; text-align: center;">
            <img src="${process.env.PUBLIC_APP_URL || 'https://app.myperfectmeals.ai'}/icons/icon-192x192.png" alt="My Perfect Meals" style="width: 64px; height: 64px; border-radius: 14px; margin-bottom: 12px;" />
            <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">New Client Message</h1>
            <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 14px;">My Perfect Meals — ProCare</p>
          </div>
          <div style="background: #111; padding: 28px 24px;">
            <p style="color: #fff; font-size: 16px; margin: 0 0 6px;">Hi ${coachName},</p>
            <p style="color: rgba(255,255,255,0.75); font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
              <strong style="color: #F97316;">${clientName}</strong> sent you a new message in the ProCare portal.
            </p>
            <div style="background: #1a1a1a; border-left: 3px solid #F97316; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
              <p style="color: rgba(255,255,255,0.55); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Message</p>
              <p style="color: #fff; font-size: 15px; line-height: 1.5; margin: 0; font-style: italic;">"${preview}"</p>
            </div>
            <div style="text-align: center; margin: 0 0 24px;">
              <a href="${portalUrl}" style="background: #F97316; color: #000; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">
                Open ProCare Portal →
              </a>
            </div>
            <p style="color: rgba(255,255,255,0.35); font-size: 12px; text-align: center; margin: 0;">
              You're receiving this because a client messaged you on My Perfect Meals.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[CoachAlert] Resend error:', error);
      return null;
    }

    console.log('[CoachAlert] Message alert sent:', data?.id);
    return data;
  } catch (err) {
    console.error('[CoachAlert] Email failed (non-fatal):', err);
    return null;
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

export async function sendCertificationCompleteEmail({
  to,
  userName,
  certType,
  certificateNumber,
}: {
  to: string;
  userName: string;
  certType: string;
  certificateNumber: string;
}): Promise<boolean> {
  if (!resend) {
    console.log('[Cert] Resend not available - skipping certification email');
    return false;
  }

  const certLabel = certType.includes('coaching')
    ? 'Business & Coaching Affiliate Certification'
    : 'Social & Referral Affiliate Certification';

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: `Certification Complete — ${certLabel}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#ea580c 0%,#9a3412 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:26px;">Affiliate Certification Complete</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">My Perfect Meals</p>
          </div>
          <div style="background:#f9fafb;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
            <h2 style="color:#111827;font-size:20px;margin-top:0;">Congratulations, ${userName}!</h2>
            <p style="color:#374151;font-size:15px;line-height:1.6;">You have successfully completed the <strong>${certLabel}</strong>.</p>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
              <p style="color:#92400e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Certificate Number</p>
              <p style="color:#7c2d12;font-size:22px;font-weight:700;font-family:monospace;margin:0;">${certificateNumber}</p>
            </div>
            <p style="color:#374151;font-size:14px;line-height:1.6;">Your Affiliate Dashboard and marketing resources are now available inside the My Perfect Meals Business Suite.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">My Perfect Meals — Personalized Nutrition &amp; Meal Planning</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[Cert] Resend error:', error);
      return false;
    }
    console.log('[Cert] Certification email sent:', data?.id);
    return true;
  } catch (err) {
    console.error('[Cert] Email failed:', err);
    return false;
  }
}

// ─── AFFILIATE WELCOME EMAIL ──────────────────────────────────────────────────

export async function sendAffiliateWelcomeEmail({
  to,
  name,
  referralUrl,
  referralToken,
  track,
}: {
  to: string;
  name: string;
  referralUrl: string;
  referralToken: string;
  track: string;
}): Promise<boolean> {
  if (!resend) {
    console.log('⚠️ Resend not available — skipping affiliate welcome email');
    return false;
  }

  const trackLabel =
    track === 'business_affiliate'
      ? 'Business & Coaching Affiliate'
      : 'Social & Referral Affiliate';

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: 'Welcome to the My Perfect Meals Affiliate Program',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
          <h1 style="color:#f97316;font-size:24px;margin-bottom:8px;">Congratulations, ${name}!</h1>
          <p style="color:#ccc;font-size:15px;line-height:1.6;margin-bottom:24px;">
            You have successfully completed your <strong>${trackLabel}</strong> certification and your affiliate account is now active.
          </p>

          <div style="background:#111;border:1px solid #f97316;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="color:#f97316;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Your Referral Link</p>
            <p style="font-family:monospace;font-size:14px;color:#fff;margin:0;word-break:break-all;">${referralUrl}</p>
            <p style="color:#888;font-size:12px;margin:8px 0 0;">Token: <strong style="color:#f97316;">${referralToken}</strong></p>
          </div>

          <div style="background:#111;border:1px solid #333;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="color:#f97316;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">Commission Terms</p>
            <ul style="color:#ccc;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
              <li>30% commission on every referred subscription</li>
              <li>Commission paid for 24 months per referred customer</li>
              <li>Real-time tracking in your affiliate dashboard</li>
            </ul>
          </div>

          <p style="color:#888;font-size:13px;line-height:1.6;margin-bottom:24px;">
            <strong style="color:#fff;">Brand Standards Reminder:</strong> When promoting My Perfect Meals, please use only approved marketing materials and messaging. Do not make medical claims, income guarantees, or use unapproved imagery.
          </p>

          <div style="text-align:center;margin-top:32px;">
            <a href="https://myperfectmeals.app/business-center/affiliate/dashboard" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">Open Affiliate Dashboard</a>
          </div>

          <p style="color:#555;font-size:12px;margin-top:32px;text-align:center;">
            My Perfect Meals — Adaptive AI Nutrition Platform<br/>
            Questions? Contact your affiliate support team.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Affiliate] Welcome email Resend error:', error);
      return false;
    }
    console.log('[Affiliate] Welcome email sent:', data?.id);
    return true;
  } catch (err) {
    console.error('[Affiliate] Welcome email failed:', err);
    return false;
  }
}

// ─── AFFILIATE REFERRAL INVITE ────────────────────────────────────────────────

export async function sendAffiliateReferralInvite({
  to,
  toName,
  fromName,
  referralUrl,
}: {
  to: string;
  toName: string;
  fromName: string;
  referralUrl: string;
}): Promise<boolean> {
  if (!resend) {
    console.log('⚠️ Resend not available — skipping affiliate referral invite');
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: `${fromName} invited you to try My Perfect Meals`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#0a0a0a;color:#fff;border-radius:16px;">
          <p style="color:#f97316;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 16px;">Personal Invitation</p>
          <h1 style="color:#fff;font-size:24px;margin-bottom:8px;">Hi ${toName || 'there'},</h1>
          <p style="color:#ccc;font-size:15px;line-height:1.6;margin-bottom:24px;">
            <strong style="color:#f97316;">${fromName}</strong> thinks you'd love My Perfect Meals — an AI-powered nutrition platform that builds personalized meal plans around your dietary needs, health goals, and food preferences.
          </p>

          <div style="background:#111;border:1px solid #f97316;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="color:#f97316;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Your Invitation Link</p>
            <p style="font-family:monospace;font-size:13px;color:#fff;margin:0;word-break:break-all;">${referralUrl}</p>
          </div>

          <div style="background:#111;border:1px solid #333;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="color:#f97316;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">What You Get</p>
            <ul style="color:#ccc;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
              <li>AI-generated meal plans tailored to your diet</li>
              <li>Macro tracking and nutrition insights</li>
              <li>Chef's Kitchen, Snack Creator, Meal Planner &amp; more</li>
              <li>Clinical support for medical dietary needs</li>
            </ul>
          </div>

          <div style="text-align:center;margin-top:32px;">
            <a href="${referralUrl}" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">Get Started Free</a>
          </div>

          <p style="color:#555;font-size:12px;margin-top:32px;text-align:center;">
            My Perfect Meals — Adaptive AI Nutrition Platform
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Affiliate] Referral invite Resend error:', error);
      return false;
    }
    console.log('[Affiliate] Referral invite sent:', data?.id);
    return true;
  } catch (err) {
    console.error('[Affiliate] Referral invite failed:', err);
    return false;
  }
}

// ─── MARKETING & COACHING ENROLLMENT NOTIFICATION ────────────────────────────

export async function sendMarketingCoachingEnrollmentEmail({
  to,
  userName,
  appUrl,
}: {
  to: string;
  userName: string;
  appUrl: string;
}): Promise<boolean> {
  if (!resend) {
    console.log('[MarketingCoaching] Resend not available — skipping enrollment notification');
    return false;
  }

  const enrollUrl = `${appUrl}/business-center/certifications/marketing_coaching`;

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: 'Enrollment is now open — Marketing & Coaching Certification',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #000000 0%, #ea580c 50%, #000000 100%); padding: 36px 30px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <img src="${appUrl}/icons/icon-192x192.png" alt="My Perfect Meals" style="width: 64px; height: 64px; border-radius: 16px; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;" />
            <h1 style="color: white; margin: 0 0 8px; font-size: 26px; font-weight: 800; letter-spacing: -0.3px;">Enrollment Is Open</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 15px;">Marketing &amp; Coaching Certification — My Perfect Meals</p>
          </div>

          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; font-size: 20px; margin: 0 0 16px;">Hi ${userName},</h2>

            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
              Great news — the <strong>Marketing &amp; Coaching Certification</strong> program you waitlisted for is now officially open for enrollment.
            </p>

            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              This certification gives you the tools and training to grow your client base, market your coaching services effectively, and build a thriving practice on My Perfect Meals.
            </p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${enrollUrl}" style="display: inline-block; background: #ea580c; color: white; padding: 14px 36px; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 16px; letter-spacing: 0.2px;">
                Start Enrollment Now →
              </a>
            </div>

            <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #9a3412; font-size: 14px; margin: 0; line-height: 1.6;">
                <strong>You're on the list:</strong> You were among the first to express interest in this program. Spots are limited — enroll now to secure your place.
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              My Perfect Meals — Personalized Nutrition &amp; Meal Planning<br>
              You're receiving this because you joined the Marketing &amp; Coaching waitlist.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[MarketingCoaching] Resend error:', error);
      return false;
    }
    console.log('[MarketingCoaching] Enrollment notification sent:', data?.id);
    return true;
  } catch (err) {
    console.error('[MarketingCoaching] Enrollment notification failed:', err);
    return false;
  }
}

export async function sendWhiteLabelAdminNotification({
  name,
  email,
  businessName,
  audienceSize,
  useCase,
}: {
  name: string;
  email: string;
  businessName: string;
  audienceSize?: string;
  useCase: string;
}) {
  if (!resend) {
    console.log('[WhiteLabel] Resend not available — skipping admin notification');
    return null;
  }
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'hello@myperfectmeals.com';
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [adminEmail],
      subject: `New White Label Partnership Application — ${businessName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 28px 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">New Partnership Application</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">White Label Solutions — Action Required</p>
          </div>
          <div style="background: #f9fafb; padding: 28px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 160px;">Name</td><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">${name}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Email</td><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;"><a href="mailto:${email}" style="color: #ea580c;">${email}</a></td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Organization</td><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">${businessName}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Audience Size</td><td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${audienceSize || 'Not provided'}</td></tr>
            </table>
            <div style="margin-top: 20px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px;">Use Case</p>
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; color: #111827; font-size: 14px; line-height: 1.6;">${useCase}</div>
            </div>
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px;">This application was submitted through the White Label Solutions qualification funnel. All 13 stages were acknowledged before submission.</p>
          </div>
        </div>
      `,
    });
    if (error) console.error('[WhiteLabel] Admin notification Resend error:', error);
    else console.log('[WhiteLabel] Admin notification sent:', data?.id);
    return data;
  } catch (err) {
    console.error('[WhiteLabel] Admin notification failed:', err);
    return null;
  }
}

export async function sendWhiteLabelApplicantConfirmation({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  if (!resend) {
    console.log('[WhiteLabel] Resend not available — skipping applicant confirmation');
    return null;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [email],
      subject: 'We received your White Label Partnership application',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 28px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Application Received</h1>
          </div>
          <div style="background: #f9fafb; padding: 28px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; font-size: 18px; margin: 0 0 12px;">Hi ${name},</h2>
            <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              Thank you for applying to the My Perfect Meals White Label Partnership Program. We've received your application and our partnership team will complete an initial review and fit assessment.
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
              If your application indicates a strong fit, you'll hear from us to schedule a discovery call.
            </p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 12px;">What happens next:</p>
              <ol style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Initial review and fit assessment</li>
                <li>Discovery call (if strong fit confirmed)</li>
                <li>Written proposal with investment breakdown</li>
                <li>Agreement and 12-week launch kickoff</li>
              </ol>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin: 0;">Please note that submitting this application does not guarantee acceptance. We review each application individually.</p>
          </div>
        </div>
      `,
    });
    if (error) console.error('[WhiteLabel] Applicant confirmation Resend error:', error);
    else console.log('[WhiteLabel] Applicant confirmation sent:', data?.id);
    return data;
  } catch (err) {
    console.error('[WhiteLabel] Applicant confirmation failed:', err);
    return null;
  }
}

// ─── BUSINESS WELCOME EMAIL ───────────────────────────────────────────────────

export async function sendBusinessWelcomeEmail({
  to,
  ownerName,
  orgName,
  seatCount,
  dashboardUrl,
  idempotencyKey,
}: {
  to: string;
  ownerName: string;
  orgName: string;
  seatCount: number;
  dashboardUrl: string;
  /** Stable provider idempotency key — pass the DB-stored welcomeEmailKey so Resend deduplicates retries. */
  idempotencyKey?: string;
}): Promise<boolean> {
  if (!resend) {
    console.log('[BusinessWelcome] Resend not available — skipping welcome email');
    return false;
  }

  const inviteUrl = dashboardUrl;
  const clientsUrl = dashboardUrl;
  const partnerUrl = dashboardUrl.replace('/business-dashboard', '/business-center');

  try {
    const { data, error } = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to: [to],
        subject: `Welcome to My Perfect Meals Business — ${orgName} is ready`,
        html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <p style="color: #93c5fd; margin: 0 0 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">My Perfect Meals</p>
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2;">Your Business Account is Active</h1>
            <p style="color: #bfdbfe; margin: 12px 0 0; font-size: 16px;">${orgName} &mdash; ${seatCount} seat${seatCount !== 1 ? 's' : ''}</p>
          </div>

          <!-- Body -->
          <div style="background: #f9fafb; padding: 32px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">

            <h2 style="color: #111827; font-size: 20px; margin: 0 0 12px;">Hi ${ownerName},</h2>
            <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
              Payment is confirmed and your Clinical Business account for <strong>${orgName}</strong> is live. You have <strong>${seatCount} seat${seatCount !== 1 ? 's' : ''}</strong> available — here's how to get the most out of them right away.
            </p>

            <!-- CTA -->
            <div style="text-align: center; margin: 0 0 36px;">
              <a href="${dashboardUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 44px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 17px; letter-spacing: 0.2px;">
                Open Business Dashboard →
              </a>
            </div>

            <!-- 3-step guide -->
            <h2 style="color: #111827; font-size: 17px; font-weight: 700; margin: 0 0 20px;">Your next 3 steps</h2>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
              <tr>
                <td style="vertical-align: top; width: 40px; padding-bottom: 24px;">
                  <div style="width: 30px; height: 30px; background: #2563eb; border-radius: 50%; text-align: center; line-height: 30px; color: white; font-weight: 700; font-size: 14px;">1</div>
                </td>
                <td style="vertical-align: top; padding-bottom: 24px; padding-left: 14px;">
                  <strong style="color: #111827; font-size: 15px;">Invite your team</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Add coaches, trainers, and staff from the <strong>Team</strong> tab. Each team member gets their own professional seat with full platform access and their own ProCare Studio.<br/>
                    <a href="${inviteUrl}" style="color: #2563eb; font-size: 13px;">Invite team members →</a>
                  </span>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 40px; padding-bottom: 24px;">
                  <div style="width: 30px; height: 30px; background: #2563eb; border-radius: 50%; text-align: center; line-height: 30px; color: white; font-weight: 700; font-size: 14px;">2</div>
                </td>
                <td style="vertical-align: top; padding-bottom: 24px; padding-left: 14px;">
                  <strong style="color: #111827; font-size: 15px;">Invite your clients</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Send complimentary access invitations directly from the <strong>Clients</strong> tab. Clients get a dedicated onboarding flow and their trial starts the moment they accept.<br/>
                    <a href="${clientsUrl}" style="color: #2563eb; font-size: 13px;">Invite clients →</a>
                  </span>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 40px;">
                  <div style="width: 30px; height: 30px; background: #059669; border-radius: 50%; text-align: center; line-height: 30px; color: white; font-weight: 700; font-size: 14px;">3</div>
                </td>
                <td style="vertical-align: top; padding-left: 14px;">
                  <strong style="color: #111827; font-size: 15px;">Explore the Partner Center</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Access certifications, affiliate tools, marketing resources, and your referral dashboard — everything you need to grow your practice.<br/>
                    <a href="${partnerUrl}" style="color: #059669; font-size: 13px;">Open Partner Center →</a>
                  </span>
                </td>
              </tr>
            </table>

            <!-- Seat summary -->
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 18px 22px; margin-bottom: 28px;">
              <p style="color: #1d4ed8; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Account Summary</p>
              <p style="color: #374151; font-size: 14px; margin: 0; line-height: 1.8;">
                <strong>Organization:</strong> ${orgName}<br/>
                <strong>Seats available:</strong> ${seatCount}<br/>
                <strong>Plan:</strong> Clinical Business Monthly
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              My Perfect Meals — Personalized Nutrition &amp; Meal Planning<br/>
              Questions? Reply to this email or visit your dashboard for help.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #1f2937; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              You're receiving this because you just activated a Clinical Business account on My Perfect Meals.
            </p>
          </div>

        </div>
      `,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (error) {
      console.error('[BusinessWelcome] Resend error:', error);
      return false;
    }
    console.log('[BusinessWelcome] Welcome email sent:', data?.id);
    return true;
  } catch (err) {
    console.error('[BusinessWelcome] Email failed:', err);
    return false;
  }
}

export async function sendBusinessInviteEmail({
  to,
  businessName,
  inviterName,
  inviteLink,
  role,
  expiresAt,
  invitationType = 'team_member',
  trialDays,
  programName,
}: {
  to: string;
  businessName: string;
  inviterName: string;
  inviteLink: string;
  role: string;
  expiresAt: Date;
  invitationType?: 'team_member' | 'client';
  trialDays?: number | null;
  programName?: string | null;
}) {
  if (!resend) {
    console.log('⚠️ Resend service not available - skipping business invite email');
    return null;
  }

  const expiryStr = expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const resolvedProgram = programName || "My Perfect Meals Complimentary Access";
  const resolvedDays = trialDays ?? 30;

  // ── Client invitation email ────────────────────────────────────────────────
  if (invitationType === 'client') {
    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: [to],
        subject: `${businessName} invited you to ${resolvedProgram}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <p style="color: #93c5fd; margin: 0 0 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">My Perfect Meals</p>
              <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; line-height: 1.2;">Welcome to ${resolvedProgram}</h1>
              <p style="color: #bfdbfe; margin: 12px 0 0; font-size: 16px;">${businessName} has given you <strong style="color: white;">${resolvedDays} days</strong> of complimentary access</p>
            </div>

            <!-- Body -->
            <div style="background: #f9fafb; padding: 32px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">

              <!-- Sent by -->
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
                <p style="color: #374151; font-size: 14px; margin: 0;">
                  <strong style="color: #1d4ed8;">Sent by ${inviterName}</strong> on behalf of ${businessName}
                </p>
              </div>

              <!-- What you get -->
              <h2 style="color: #111827; font-size: 17px; margin: 0 0 12px; font-weight: 700;">What's included in your ${resolvedDays}-day access:</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; AI-powered personalized meal plans</td></tr>
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; Dietary tracking &amp; biometric monitoring</td></tr>
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; Clinical nutrition protocols &amp; guidance</td></tr>
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; No credit card required to get started</td></tr>
              </table>

              <!-- CTA -->
              <div style="text-align: center; margin: 0 0 32px;">
                <a href="${inviteLink}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 44px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 17px; letter-spacing: 0.2px;">
                  Activate Your Access →
                </a>
                <p style="color: #6b7280; font-size: 13px; margin: 10px 0 0;">
                  This invitation is reserved for ${to}. Create a free account to get started.
                </p>
              </div>

              <!-- Expiry notice -->
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6;">
                  <strong>This invitation expires on ${expiryStr}.</strong> Accept before then to claim your complimentary access.
                </p>
              </div>

              <!-- Fallback link -->
              <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0;">
                Button not working? Copy and paste this link:<br/>
                <span style="word-break: break-all; color: #2563eb;">${inviteLink}</span>
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #1f2937; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                My Perfect Meals &mdash; Clinical Nutrition Platform<br/>
                <span style="color: #4b5563;">Questions? Contact ${inviterName} or reply to this email.</span>
              </p>
            </div>

          </div>
        `,
      });
      if (error) { console.error('❌ [client invite] Resend error:', error); return null; }
      console.log('✅ [client invite] Email sent:', data?.id);
      return data;
    } catch (err) {
      console.error('❌ [client invite] Email failed:', err);
      return null;
    }
  }

  // ── Team member invitation email (existing) ────────────────────────────────
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: `${inviterName} invited you to join ${businessName} on My Perfect Meals`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <p style="color: #93c5fd; margin: 0 0 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">My Perfect Meals</p>
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2;">Welcome to ${businessName}'s Team</h1>
            <p style="color: #bfdbfe; margin: 12px 0 0; font-size: 16px;">${inviterName} has invited you to join as a <strong style="color: white;">${roleLabel}</strong></p>
          </div>

          <!-- Body -->
          <div style="background: #f9fafb; padding: 32px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">

            <!-- What is MPM -->
            <h2 style="color: #111827; font-size: 18px; margin: 0 0 12px; font-weight: 700;">What is My Perfect Meals?</h2>
            <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
              My Perfect Meals is an AI-powered clinical nutrition platform built for health professionals and their clients. It generates personalized meal plans, tracks biometrics, and provides evidence-based dietary guidance — all inside one platform designed for both providers and the people they serve.
            </p>

            <!-- What you get -->
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px;">
              <h3 style="color: #1d4ed8; font-size: 15px; font-weight: 700; margin: 0 0 14px;">As a Clinical Business member, you'll have access to:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; AI-powered meal generation &amp; customization</td></tr>
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; Clinical nutrition tools &amp; dietary protocols</td></tr>
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; Biometric monitoring &amp; progress tracking</td></tr>
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; ProCare Studio — manage your own clients</td></tr>
                <tr><td style="padding: 5px 0; color: #374151; font-size: 14px;">✅&nbsp; Professional resources &amp; certification programs</td></tr>
              </table>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin: 0 0 32px;">
              <a href="${inviteLink}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 44px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 17px; letter-spacing: 0.2px;">
                Accept Invitation →
              </a>
              <p style="color: #6b7280; font-size: 13px; margin: 10px 0 0;">
                New to My Perfect Meals? You'll create a free account first.
              </p>
            </div>

            <!-- Steps -->
            <h2 style="color: #111827; font-size: 17px; font-weight: 700; margin: 0 0 16px;">What happens after you accept?</h2>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
              <tr>
                <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                  <div style="width: 28px; height: 28px; background: #2563eb; border-radius: 50%; text-align: center; line-height: 28px; color: white; font-weight: 700; font-size: 13px;">1</div>
                </td>
                <td style="vertical-align: top; padding-bottom: 18px; padding-left: 12px;">
                  <strong style="color: #111827; font-size: 14px;">Accept this invitation</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">Log in with your existing account, or create a free account — takes under a minute.</span>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                  <div style="width: 28px; height: 28px; background: #2563eb; border-radius: 50%; text-align: center; line-height: 28px; color: white; font-weight: 700; font-size: 13px;">2</div>
                </td>
                <td style="vertical-align: top; padding-bottom: 18px; padding-left: 12px;">
                  <strong style="color: #111827; font-size: 14px;">Complete your personal profile</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">Every professional first experiences the platform as a user — so you understand exactly what your clients see.</span>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                  <div style="width: 28px; height: 28px; background: #2563eb; border-radius: 50%; text-align: center; line-height: 28px; color: white; font-weight: 700; font-size: 13px;">3</div>
                </td>
                <td style="vertical-align: top; padding-bottom: 18px; padding-left: 12px;">
                  <strong style="color: #111827; font-size: 14px;">Create your Provider account</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">In the app, go to <strong>More</strong> and select <strong>Create Provider Account</strong> to begin your professional setup.</span>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 36px; padding-bottom: 18px;">
                  <div style="width: 28px; height: 28px; background: #2563eb; border-radius: 50%; text-align: center; line-height: 28px; color: white; font-weight: 700; font-size: 13px;">4</div>
                </td>
                <td style="vertical-align: top; padding-bottom: 18px; padding-left: 12px;">
                  <strong style="color: #111827; font-size: 14px;">Complete professional onboarding</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">You'll complete Platform Mastery Academy and ProCare Business Training — these courses unlock your Studio.</span>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 36px;">
                  <div style="width: 28px; height: 28px; background: #059669; border-radius: 50%; text-align: center; line-height: 28px; color: white; font-weight: 700; font-size: 13px;">5</div>
                </td>
                <td style="vertical-align: top; padding-left: 12px;">
                  <strong style="color: #111827; font-size: 14px;">Your Studio unlocks automatically</strong><br/>
                  <span style="color: #6b7280; font-size: 13px; line-height: 1.6;">Once training is complete, your ProCare Studio activates. Manage clients, generate meal plans, and access all clinical tools.</span>
                </td>
              </tr>
            </table>

            <!-- Expiry notice -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; margin-bottom: 24px; border-radius: 4px;">
              <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6;">
                <strong>This invitation expires on ${expiryStr}.</strong> Accept before then to claim your seat.
              </p>
            </div>

            <!-- Fallback link -->
            <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0;">
              Button not working? Copy and paste this link:<br/>
              <span style="word-break: break-all; color: #2563eb;">${inviteLink}</span>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #1f2937; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              My Perfect Meals &mdash; Clinical Nutrition Platform<br/>
              <span style="color: #4b5563;">Questions? Contact ${inviterName} or reply to this email.</span>
            </p>
          </div>

        </div>
      `,
    });

    if (error) {
      console.error('❌ [business invite] Resend error:', error);
      return null;
    }

    console.log('✅ [business invite] Email sent:', data?.id);
    return data;
  } catch (err) {
    console.error('❌ [business invite] Email failed:', err);
    return null;
  }
}

// ── Trial Expiry Reminder ────────────────────────────────────────────────────
export async function sendTrialExpiryReminderEmail({
  to,
  firstName,
  daysRemaining,
  trialEndsAt,
}: {
  to: string;
  firstName: string;
  daysRemaining: number;
  trialEndsAt: Date;
}) {
  if (!resend) {
    console.log('⚠️ Resend not available — skipping trial expiry reminder');
    return null;
  }

  const expiryStr = trialEndsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const isLastDay = daysRemaining === 1;
  const urgencyColor = isLastDay ? "#dc2626" : daysRemaining <= 3 ? "#d97706" : "#2563eb";
  const subjectLine = isLastDay
    ? `⏰ Last day of your My Perfect Meals trial`
    : `Your My Perfect Meals trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject: subjectLine,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 36px 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <p style="color: #9ca3af; margin: 0 0 8px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;">My Perfect Meals</p>
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; line-height: 1.2;">
              ${isLastDay ? "Today is your last day" : `${daysRemaining} days left`}
            </h1>
            <p style="color: #d1d5db; margin: 10px 0 0; font-size: 15px;">Your complimentary Pro trial expires on <strong style="color: white;">${expiryStr}</strong></p>
          </div>

          <!-- Body -->
          <div style="background: #f9fafb; padding: 32px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">

            <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">Hi ${firstName},</p>

            <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
              ${isLastDay
                ? "Your free trial ends today. After today, your account will move to the Free tier — your data and meal history stay safe, but Pro features like personalized meal plans, clinical protocols, and coaching tools will lock."
                : `You have <strong style="color: ${urgencyColor};">${daysRemaining} days</strong> left to experience everything My Perfect Meals has to offer. After your trial ends on ${expiryStr}, your account moves to the Free tier.`
              }
            </p>

            <!-- Feature list -->
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px;">
              <p style="color: #1e40af; font-size: 14px; font-weight: 700; margin: 0 0 12px;">What you keep with a Pro subscription:</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 4px 0; color: #1e3a5f; font-size: 14px;">✅&nbsp; AI-personalized meal plans</td></tr>
                <tr><td style="padding: 4px 0; color: #1e3a5f; font-size: 14px;">✅&nbsp; Clinical nutrition protocols</td></tr>
                <tr><td style="padding: 4px 0; color: #1e3a5f; font-size: 14px;">✅&nbsp; Dietary restriction &amp; condition support</td></tr>
                <tr><td style="padding: 4px 0; color: #1e3a5f; font-size: 14px;">✅&nbsp; Business Center &amp; ProCare tools</td></tr>
                <tr><td style="padding: 4px 0; color: #1e3a5f; font-size: 14px;">✅&nbsp; All your saved meals &amp; history</td></tr>
              </table>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin: 0 0 28px;">
              <a href="https://myperfectmeals.app/pricing" style="display: inline-block; background: ${urgencyColor}; color: white; padding: 16px 44px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 17px; letter-spacing: 0.2px;">
                ${isLastDay ? "Upgrade Now — Keep Pro Access" : "Upgrade to Pro"}
              </a>
              <p style="color: #6b7280; font-size: 13px; margin: 10px 0 0;">No obligation. Cancel anytime.</p>
            </div>

            <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
              Not ready to upgrade? No problem — your account and all your data will still be here whenever you decide to continue.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #1f2937; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              My Perfect Meals &mdash; Clinical Nutrition Platform<br/>
              <span style="color: #4b5563;">You're receiving this because your free trial is ending soon.</span>
            </p>
          </div>

        </div>
      `,
    });

    if (error) { console.error('❌ [trial-reminder] Resend error:', error); return null; }
    console.log(`✅ [trial-reminder] day_${daysRemaining} email sent to ${to}:`, data?.id);
    return data;
  } catch (err) {
    console.error('❌ [trial-reminder] Email failed:', err);
    return null;
  }
}
