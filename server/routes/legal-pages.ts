import { Router, Request, Response } from "express";

const router = Router();

function legalShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — My Perfect Meals</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      line-height: 1.7;
      min-height: 100vh;
    }
    header {
      background: #111;
      border-bottom: 1px solid #2a2a2a;
      padding: 18px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    header .logo {
      font-size: 1.1rem;
      font-weight: 700;
      color: #84cc16;
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    header .sep { color: #444; }
    header .page-title { font-size: 1rem; color: #aaa; }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 6px;
    }
    .meta {
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 36px;
    }
    h2 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
      margin: 32px 0 10px;
    }
    h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: #ccc;
      margin: 20px 0 6px;
    }
    p {
      color: #b0b0b0;
      font-size: 0.9rem;
      margin-bottom: 10px;
    }
    ul {
      color: #b0b0b0;
      font-size: 0.9rem;
      padding-left: 22px;
      margin-bottom: 10px;
    }
    li { margin-bottom: 4px; }
    a { color: #84cc16; text-decoration: underline; }
    strong { color: #ddd; }
    hr { border: none; border-top: 1px solid #2a2a2a; margin: 36px 0; }
    .contact-block {
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      padding: 20px;
      margin-top: 36px;
    }
  </style>
</head>
<body>
  <header>
    <a class="logo" href="/">My Perfect Meals</a>
    <span class="sep">/</span>
    <span class="page-title">${title}</span>
  </header>
  <main>
    ${body}
  </main>
</body>
</html>`;
}

const PRIVACY_BODY = `
<h1>Privacy Policy</h1>
<p class="meta">My Perfect Meals &mdash; Last Updated: January 2025</p>

<p>My Perfect Meals ("we," "us," "our") provides a personalized nutrition application powered by AI meal generation, lifestyle guidance, and optional ProCare coaching features. We are committed to protecting your privacy and handling your information responsibly.</p>
<p>By using My Perfect Meals, you agree to this Privacy Policy.</p>

<h2>1. Information We Collect</h2>
<p>We collect information to personalize nutrition guidance, improve app performance, and provide safe user experiences.</p>

<h3>1.1 Information You Provide</h3>
<p><strong>Account Information:</strong> Name, email, password, birthday (for personalization and birthday greetings).</p>
<p><strong>Health &amp; Nutrition Preferences:</strong> Dietary focus (Diabetes, GLP-1, Cardiac, Anti-Inflammatory, General Nutrition), sex, age, height, weight, allergies, activity level, glycemic preferences, macro goals and meal preferences, cravings and food preferences, fridge items you enter manually.</p>
<p><strong>Coaching / ProCare Data:</strong> If you connect with a trainer, coach, or physician through My Perfect Meals ProCare, we collect goals and assigned nutrition plans, coach-assigned adjustments, and progress notes.</p>

<h3>1.2 Automatically Collected Information</h3>
<p>Device type, OS, app version, IP address, usage patterns, error logs and crash diagnostics.</p>

<h3>1.3 Financial Information</h3>
<p>We do not collect or store your credit card information. Apple manages all in-app billing directly. Stripe processes website payments; we never store card numbers.</p>

<h3>1.4 Sensitive Health Data</h3>
<p>My Perfect Meals does not diagnose, treat, or provide medical care. Any health-related data you share is for nutrition personalization only. We do not store protected health information (PHI) as defined by HIPAA.</p>

<h2>2. How We Use Your Information</h2>
<ul>
  <li>Personalize meals, macros, and AI recommendations</li>
  <li>Provide Diabetes, GLP-1, Cardiac, and Anti-Inflammatory guardrails</li>
  <li>Build shopping lists and automate meal planning</li>
  <li>Provide birthday greetings</li>
  <li>Improve AI accuracy</li>
  <li>Offer ProCare client-coach functionality</li>
  <li>Inform you of updates, new features, or account changes</li>
  <li>Support security, fraud prevention, and authentication</li>
</ul>

<h2>3. How We Share Your Information</h2>
<p>We only share your information in the following situations.</p>

<h3>3.1 With Your Coach or Physician</h3>
<p>If you join a ProCare plan or connect with a trainer or doctor, they may see your nutrition data, assigned dietary focus, progress logs, and selected meals and macros. You control whether you connect to a coach.</p>

<h3>3.2 With Service Providers</h3>
<p>We use third-party vendors for database hosting, email delivery, analytics, crash reporting, and payment processing (Stripe and Apple).</p>

<h3>3.3 Legal Requirements</h3>
<p>We may disclose information if required by law enforcement, court order, fraud investigation, or App Store compliance.</p>

<p><strong>We do not sell or rent your information. Ever.</strong></p>

<h2>4. Data Security</h2>
<p>We use token-based authentication, encrypted data transmission (HTTPS), secure storage for user profiles, strict access controls, and continuous security monitoring. No system is 100% secure, but we maintain industry-standard protections.</p>

<h2>5. Messaging Privacy</h2>
<p>My Perfect Meals does not record or provide transcripts of coach-client conversations. All communication within ProCare is intended to remain private between the client and the coach. Users are responsible for saving any information they wish to keep. My Perfect Meals does not act as a record-keeping or documentation service for conversations.</p>

<h2>6. Your Rights</h2>
<p>Depending on your region, you may request a copy of your data, update or delete your data, withdraw consent, or close your account at any time.</p>
<p>Contact us at <a href="mailto:support@myperfectmeals.com">support@myperfectmeals.com</a> for requests.</p>

<h2>7. Children's Privacy</h2>
<p>My Perfect Meals is intended for users 13 and older. We do not knowingly collect data from children under 13.</p>

<h2>8. AI Usage Disclosure</h2>
<p>My Perfect Meals uses generative AI to suggest meals, personalize macros, transform cravings into healthier versions, and provide dietary recommendations within your selected guardrails. AI suggestions are not medical advice.</p>

<h2>9. Changes to This Policy</h2>
<p>We may update this policy periodically. Continued use of the app means you accept the updated version.</p>

<hr />

<div class="contact-block">
  <h2 style="margin-top:0">10. Contact Us</h2>
  <p>My Perfect Meals</p>
  <p>Support Email: <a href="mailto:support@myperfectmeals.com">support@myperfectmeals.com</a></p>
</div>
`;

const TERMS_BODY = `
<h1>Terms of Service</h1>
<p class="meta">My Perfect Meals &mdash; Last Updated: January 2025</p>

<p>These Terms of Service ("Terms") govern your use of My Perfect Meals. By using the app, you agree to these Terms.</p>

<h2>1. Use of the App</h2>
<p>You may use the app for personal nutrition guidance. You agree not to:</p>
<ul>
  <li>Repurpose our content</li>
  <li>Misuse AI systems</li>
  <li>Attempt to reverse engineer the platform</li>
  <li>Share accounts</li>
  <li>Circumvent paywalls</li>
</ul>

<h2>2. Not Medical Advice</h2>
<p>My Perfect Meals provides nutrition guidance, not medical care. The app does not:</p>
<ul>
  <li>Diagnose any condition</li>
  <li>Prescribe medication</li>
  <li>Replace a physician or registered dietitian</li>
</ul>
<p><strong>Always consult a licensed medical professional about your health.</strong></p>

<h2>3. Accounts and Security</h2>
<ul>
  <li>You must provide accurate information.</li>
  <li>You are responsible for your login credentials.</li>
  <li>We may suspend accounts for violations of these Terms.</li>
</ul>

<h2>4. Subscriptions &amp; Billing</h2>

<h3>4.1 Subscription Tiers</h3>
<p>My Perfect Meals may offer Basic, Premium, Ultimate, ProCare (for professionals), and affiliate discount options.</p>

<h3>4.2 Payments</h3>
<ul>
  <li>All in-app payments must use Apple In-App Purchases.</li>
  <li>Website purchases are processed via Stripe.</li>
  <li>We do not store payment information.</li>
</ul>

<h3>4.3 Trials</h3>
<p>Trials may convert automatically unless canceled before expiration.</p>

<h3>4.4 Refunds</h3>
<p>Refunds for Apple purchases must be requested through Apple Support.</p>

<h2>5. Coaches, Trainers, and Physicians</h2>
<p>If you connect your account to a coach or medical professional:</p>
<ul>
  <li>You authorize us to share relevant nutrition data with them</li>
  <li>They may assign goals, macros, or meal plans</li>
  <li>You can disconnect at any time</li>
</ul>
<p>Professionals are independent contractors, not employees of My Perfect Meals.</p>

<h2>6. Affiliate Program</h2>
<p>My Perfect Meals may offer an affiliate program. Affiliates receive compensation for users who subscribe using their code. Fraudulent referrals or self-referrals are prohibited. Affiliate benefits do not override subscription pricing rules. We may change commission structures with notice.</p>

<h2>7. AI Systems</h2>
<p>AI-generated content may be imperfect, approximate, based on your inputs, and subject to nutritional limitations. You agree not to rely solely on AI recommendations for health decisions.</p>

<h2>8. Termination</h2>
<p>We may suspend or terminate accounts that violate these Terms, abuse the system, attempt to exploit subscriptions, or harm the platform. You may close your account at any time.</p>

<h2>9. Limitation of Liability</h2>
<p>To the maximum extent permitted by law:</p>
<ul>
  <li>My Perfect Meals is not liable for medical outcomes</li>
  <li>Not liable for reliance on dietary suggestions</li>
  <li>Not liable for indirect, incidental, or consequential damages</li>
</ul>
<p>Use the app at your own discretion.</p>

<h2>10. Governing Law</h2>
<p>These Terms are governed by the laws of the United States and the state where the company is registered.</p>

<hr />

<div class="contact-block">
  <h2 style="margin-top:0">11. Contact Us</h2>
  <p>My Perfect Meals</p>
  <p>Support Email: <a href="mailto:support@myperfectmeals.com">support@myperfectmeals.com</a></p>
</div>
`;

router.get("/privacy-policy", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(legalShell("Privacy Policy", PRIVACY_BODY));
});

router.get("/terms", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(legalShell("Terms of Service", TERMS_BODY));
});

router.get("/terms-of-service", (_req: Request, res: Response) => {
  res.redirect(301, "/terms");
});

export default router;
