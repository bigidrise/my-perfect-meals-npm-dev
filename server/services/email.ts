import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!resend) {
  console.warn("[Email] RESEND_API_KEY not configured — email notifications disabled.");
}

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: "My Perfect Meals <no-reply@myperfectmeals.com>",
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[Email] Failed to send email to", to, err);
  }
}
