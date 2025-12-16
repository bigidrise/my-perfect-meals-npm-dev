# 🌍 ENVIRONMENT SETUP: Dev vs Staging

## PURPOSE
This guide explains how to manage environment-specific configurations for Development and Staging deployments.

---

## 📋 ENVIRONMENT COMPARISON

| Feature | Development | Staging | Production (Future) |
|---------|-------------|---------|---------------------|
| **Who Uses** | You only | Beta testers | Public users |
| **Database** | Dev database | Staging database | Production database |
| **Stripe Mode** | Test | Test | **Live** |
| **API Keys** | Test/Dev | Test/Dev | Production |
| **URL** | Replit dev URL | Custom staging URL | App domain |
| **Data** | Fake/test data | Test user data | Real user data |
| **Can Reset** | ✅ Yes | ✅ Yes | ❌ NEVER |

---

## 🔐 SECRETS MANAGEMENT

### **CURRENT SECRETS (Development)**

You already have these set in Replit Secrets:

```
ELEVENLABS_API_KEY     - Voice synthesis
OPENAI_API_KEY         - AI meal generation
STRIPE_SECRET_KEY      - Payment processing (test mode)
STRIPE_WEBHOOK_SECRET  - Stripe webhook verification
```

### **STAGING SECRETS (To Be Added)**

When you create staging deployment, add these:

```
ELEVENLABS_API_KEY     - Same as dev (or separate budget key)
OPENAI_API_KEY         - Same as dev (or separate budget key)
STRIPE_SECRET_KEY      - Test mode (sk_test_...)
STRIPE_WEBHOOK_SECRET  - New webhook for staging URL
DATABASE_URL           - Staging database connection
```

### **PRODUCTION SECRETS (Future - January 2025)**

When you launch to App Store, use these:

```
ELEVENLABS_API_KEY     - Production key with higher limits
OPENAI_API_KEY         - Production key with higher limits
STRIPE_SECRET_KEY      - **LIVE mode (sk_live_...)**
STRIPE_WEBHOOK_SECRET  - Production webhook
DATABASE_URL           - Production database connection
SENDGRID_API_KEY       - Production email sending
TWILIO_ACCOUNT_SID     - Production SMS (if needed)
TWILIO_AUTH_TOKEN      - Production SMS (if needed)
```

---

## 🔑 HOW TO ADD SECRETS IN REPLIT

### **For Development (Current Workspace):**

1. Open the **Tools** panel (left sidebar)
2. Click **"Secrets"**
3. Click **"Add Secret"**
4. Enter name and value
5. Secret is automatically available as `process.env.SECRET_NAME`

### **For Staging Deployment:**

1. Go to your **Deployment page**
2. Click **"Settings"** or **"Environment"** tab
3. Add secrets specific to staging
4. These secrets **only** exist in staging, not in dev

### **Best Practice:**

- Keep dev and staging secrets **separate**
- Never use production secrets in dev/staging
- Use Stripe test mode in both dev and staging
- Document which keys are which

---

## 💳 STRIPE CONFIGURATION

### **Development & Staging (Test Mode):**

```env
STRIPE_SECRET_KEY=sk_test_... (starts with sk_test)
STRIPE_WEBHOOK_SECRET=whsec_... (staging needs its own)
```

**In your Stripe Dashboard:**
1. Use **"Test Mode"** toggle (top right)
2. Test cards work: `4242 4242 4242 4242`
3. No real charges are made
4. Use test webhook endpoints

### **Production (Live Mode - Future):**

```env
STRIPE_SECRET_KEY=sk_live_... (starts with sk_live)
STRIPE_WEBHOOK_SECRET=whsec_... (production webhook)
```

**In your Stripe Dashboard:**
1. Switch to **"Live Mode"**
2. Real cards are charged
3. Real money is processed
4. Use production webhook endpoints

**⚠️ CRITICAL:** Never use live Stripe keys in development or staging!

---

## 🗄️ DATABASE SETUP

### **Development Database (Current):**

You're using Neon Database (serverless PostgreSQL).

**Connection:**
- Managed by Replit
- `DATABASE_URL` environment variable
- Contains your test data

### **Staging Database (To Create):**

**Option 1: Create New Neon Database**
1. Go to Neon Dashboard
2. Create new project: "My Perfect Meals - Staging"
3. Copy connection string
4. Add to staging deployment as `DATABASE_URL`

**Option 2: Use Replit Database**
1. In staging deployment, enable Replit Database
2. Automatically creates separate staging DB
3. Simpler but less control

**Best Practice:**
- Keep staging and dev databases completely separate
- Staging should have clean test data for beta testers
- Never point staging at production database

### **Production Database (Future):**

Will be a separate production Neon database with:
- Real user data
- Automated backups
- High availability
- Strict access controls

---

## 📧 EMAIL & SMS CONFIGURATION

### **Current Status:**

You have these in your `missing_secrets` list:
- `SENDGRID_API_KEY` - Email sending
- `TWILIO_ACCOUNT_SID` - SMS sending
- `TWILIO_AUTH_TOKEN` - SMS sending
- `TWILIO_PHONE_NUMBER` - SMS sending

### **When to Add:**

**Development:**
- Not critical yet
- Use console logging for testing

**Staging:**
- Add if beta testers need email notifications
- Use SendGrid sandbox mode
- Use Twilio test credentials

**Production:**
- Required for real user notifications
- Production SendGrid account
- Production Twilio account with real phone number

---

## 🌐 ENVIRONMENT DETECTION IN CODE

Your code can detect which environment it's running in:

```javascript
// Check if in development
const isDevelopment = process.env.NODE_ENV === 'development';

// Check if in staging
const isStaging = process.env.REPLIT_DEPLOYMENT === 'staging';

// Check if in production
const isProduction = process.env.NODE_ENV === 'production';
```

Use this to:
- Show debug info only in dev
- Enable different features per environment
- Use different API endpoints
- Adjust logging levels

---

## 🔧 ENVIRONMENT VARIABLES YOU MIGHT NEED

### **Current Environment Variables:**

Your app already uses these from Replit:
- `DATABASE_URL` - Database connection
- `PORT` - Server port (auto-set by Replit)
- Various Stripe/API keys

### **Additional Variables for Staging:**

```env
NODE_ENV=staging
REPLIT_DEPLOYMENT=staging
FRONTEND_URL=https://staging.myperfectmeals.com
API_BASE_URL=https://staging.myperfectmeals.com
```

### **Additional Variables for Production:**

```env
NODE_ENV=production
REPLIT_DEPLOYMENT=production
FRONTEND_URL=https://app.myperfectmeals.com
API_BASE_URL=https://app.myperfectmeals.com
```

---

## 🚨 SECURITY BEST PRACTICES

### ✅ DO:
- Use separate secrets for each environment
- Keep staging and production databases separate
- Use Stripe test mode in dev/staging
- Rotate production secrets regularly
- Use strong, unique values for each secret

### ❌ DON'T:
- Never commit secrets to git
- Never use production secrets in dev/staging
- Never share production database credentials
- Never log secret values
- Never use weak/default secret values

---

## 📊 CHECKLIST: Setting Up Staging

Before giving staging to beta testers:

- [ ] Staging deployment created in Replit
- [ ] All secrets added to staging environment
- [ ] Stripe test mode keys configured
- [ ] Staging database created and connected
- [ ] Environment variables set correctly
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Test deployment works
- [ ] No errors in deployment logs
- [ ] Beta tester accounts created
- [ ] Feedback collection system ready

---

## 🆘 TROUBLESHOOTING

### **"Cannot connect to database"**
- Check `DATABASE_URL` is set in staging
- Verify database is running
- Check connection string format

### **"Stripe API key invalid"**
- Verify you're using test keys (sk_test_...)
- Check key is from correct Stripe account
- Ensure key has correct permissions

### **"Environment variable undefined"**
- Check secret is added in deployment settings
- Restart deployment after adding secrets
- Verify variable name matches code

### **"CORS errors in staging"**
- Add staging URL to CORS whitelist
- Check API_BASE_URL is correct
- Verify frontend URL matches

---

## 📞 NEED HELP?

If you need assistance with:
- Adding secrets to deployments
- Configuring databases
- Setting up Stripe webhooks
- Environment-specific configurations

Just ask! The agent can help you configure each environment correctly.

---

**Remember: Proper environment separation is crucial for security and stability!** 🔐
