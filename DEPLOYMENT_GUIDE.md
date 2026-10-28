# Deployment guide: current Development → Production workflow

## Current release procedure

The historical staging proposal below is **not the current deployment setup**.
Use this procedure and `ROLLBACK.md` for releases:

1. Build and test in the Development workspace on `dev`.
2. Review and commit only the intended changes, run the required validation,
   then push `dev`. A Git push does **not** publish an app.
3. Review and merge the approved changes from `dev` into `production`.
   `main` and `staging` are not the current release targets.
4. In the separate Production workspace, confirm the branch is `production`,
   inspect the working tree, and stop if changes need preserving. Once approved,
   update with `git pull --ff-only origin production`.
5. Obtain separate approval for any migration, configuration change or release
   prerequisite. Run the Production pre-publish checks; do not bypass failures.
6. Explicitly publish from the **Production workspace**, not this Development
   workspace. Publishing here updates the Development project's deployment.
7. Run `bash scripts/run-prod-acceptance.sh --sha <published-commit-sha>`.
   A browser visit to `/api/health` alone is not release acceptance.
8. Only after acceptance passes and warnings are reviewed, record the actual
   published SHA and date in `LAST_STABLE.md`. Preserve the previous entry if
   verification fails. Commit the record on `production`, not `main`.

### Verified environment boundaries

- Customer app: `https://app.myperfectmeals.ai`.
- Published Production app: `https://my-perfect-meals-new-prod.replit.app`.
- Production editor: `https://replit.com/@bigidrise/my-perfect-meals-new-prod`.
- The workspaces share external Neon. Development is **not** a disposable test
  database; account creation and database writes can affect real accounts.
- Stripe modes and other settings must be verified in the intended runtime;
  do not infer test mode from being in Development.
- Ordinary `/auth` is sign-in, not a 30-day pilot invitation. A Development-only
  campaign must not be distributed as a working Production invitation.
- The legacy root `push.sh` stages all changes and pushes `staging`; it is not
  the current release helper and does not publish Replit deployments.

---

## Archived staging proposal — not operational instructions

The remainder records an earlier proposed setup, not verified current
infrastructure. Its database isolation, Stripe test-mode and future-production
claims do not describe the current project. Do not execute its setup commands
or distribute its example URLs without a separately approved staging project.

## PURPOSE
This guide shows how to set up and manage your **Development → Staging** workflow for My Perfect Meals, just like Facebook, Twitter, and other professional software companies.

---

## 📋 THE TWO-STAGE SYSTEM

### **STAGE 1: DEVELOPMENT (Current Workspace)**
- **Who uses it:** Only you
- **What it's for:** Building features, making changes, testing
- **Database:** Test data
- **Stripe:** Test mode keys
- **URL:** Current Replit development URL

### **STAGE 2: STAGING (Beta Testing)**
- **Who uses it:** Beta testers (trainers, doctors, clients)
- **What it's for:** Real-world testing before public launch
- **Database:** Separate staging database with beta tester accounts
- **Stripe:** Test mode keys (no real charges)
- **URL:** Custom URL (e.g., staging.myperfectmeals.com)

### **STAGE 3: PRODUCTION (Future - January 2025)**
- **Who uses it:** Public App Store users
- **What it's for:** The real app
- **Database:** Production database with real user data
- **Stripe:** Live mode keys (real charges)
- **URL:** The original proposed domain is obsolete; use the verified customer URL in the current procedure above.

---

## 🎯 CURRENT STATUS: Development Phase

You are currently in **Stage 1 (Development)**. You have:
- ✅ Working codebase with all features
- ✅ Lockdown system protecting against breakages
- ✅ Test database with your data
- ✅ Stripe test mode configured

**Next step:** Set up Stage 2 (Staging) for beta testing.

---

## 🔧 HOW TO CREATE STAGING DEPLOYMENT

### **STEP 1: Prepare Your Development Environment**

1. **Ensure all features are working** in your current workspace
2. **Commit all changes to git:**
   ```bash
   ./push.sh "Final development commit before staging setup"
   ```
3. **Verify test Stripe keys are set** (not production keys)

### **STEP 2: Create Staging Deployment**

1. **In your Replit workspace**, click **"Deploy"** button (top right)
2. **Choose deployment type:** "Autoscale" (recommended for web apps)
3. **Configure deployment:**
   - Name: "My Perfect Meals - Staging"
   - Machine type: Start with smallest (you can scale up later)
   - Build command: (leave default)
   - Run command: (should auto-detect from your workflow)

4. **Click "Deploy"** - Replit will create your staging environment

### **STEP 3: Configure Staging Environment Variables**

Your staging deployment needs separate environment variables from development.

**In the Deployment Settings:**

1. **Add these secrets** (use Replit Secrets tool):
   - `OPENAI_API_KEY` - Same as development (or separate budget key)
   - `STRIPE_SECRET_KEY` - **Test mode key** (starts with `sk_test_`)
   - `STRIPE_WEBHOOK_SECRET` - New webhook secret for staging
   - `ELEVENLABS_API_KEY` - Same as development
   - `DATABASE_URL` - Staging database connection (see below)

2. **Database Setup for Staging:**
   - Option A: Create new Postgres database in Replit for staging
   - Option B: Use Neon separate staging database
   - Keep staging data separate from development!

### **STEP 4: Test Staging Deployment**

1. **Visit your staging URL** (Replit provides this)
2. **Create a test account** in staging
3. **Test critical features:**
   - User signup/login
   - AI meal generation
   - Meal board functionality
   - Stripe checkout (test mode)
   - Database persistence

4. **Verify no errors** in deployment logs

### **STEP 5: Configure Custom Domain (Optional)**

If you want `staging.myperfectmeals.com`:

1. **In Deployment Settings**, go to "Domains"
2. **Add custom domain:** staging.myperfectmeals.com
3. **Configure DNS** (Replit provides instructions)
4. **Wait for SSL certificate** to provision

---

## 🔄 WORKFLOW: Development → Staging

### **Daily Workflow:**

```
1. Make changes in DEVELOPMENT workspace
   ↓
2. Test locally - make sure everything works
   ↓
3. Commit to git: ./push.sh "Description of changes"
   ↓
4. Review and merge the approved changes into the intended release branch
   ↓
5. Explicitly publish the intended project, then run live acceptance
   ↓
6. They report bugs/feedback
   ↓
7. Fix bugs in DEVELOPMENT
   ↓
8. Repeat until stable
```

### Publishing is separate from Git

A Git push synchronizes repository history; it does not automatically publish
this application. Use Replit's Publishing tool in the intended workspace after
the required approvals and checks. Do not assume a branch-triggered deployment
exists or enable one as part of following this guide.

---

## 👥 MANAGING BETA TESTERS

### **How to Give Access to Beta Testers:**

**Option 1: Share Staging URL**
- Send them the staging URL
- They create accounts directly
- You monitor their usage

**Option 2: Create Test Accounts**
- Create accounts for each beta tester
- Send them login credentials
- Track specific user feedback

### **Beta Tester Instructions:**

Send this to your trainers/doctors/clients:

```
Welcome to My Perfect Meals Beta Testing!

1. Visit: [Your Staging URL]
2. Create an account (or use provided credentials)
3. Test these features:
   - Create AI meals
   - Track your macros
   - Use the meal boards
   - Try the trainer/client features
4. Report any bugs or issues to: [Your Email]

Important: This is a TEST environment. Do NOT enter real payment info.
All payments use Stripe TEST mode.
```

### **Collecting Feedback:**

Create a simple feedback system:
- Google Form for bug reports
- Shared Slack/Discord channel
- Email directly
- In-app feedback button (future feature)

---

## 🔐 SECURITY: Staging vs Production

### **Staging Environment (Safe for Testing):**
- ✅ Uses Stripe TEST mode (no real charges)
- ✅ Separate database (no real user data)
- ✅ Can be reset/wiped without consequences
- ✅ Beta testers can't access production data

### **Production Environment (Future - Real Users):**
- ⚠️ Uses Stripe LIVE mode (real charges)
- ⚠️ Real user data and PII
- ⚠️ Must never be reset or wiped
- ⚠️ Requires strict security protocols

**Critical Rule:** NEVER use production Stripe keys in staging. NEVER use staging database for production.

---

## 📊 MONITORING STAGING

### **What to Watch:**

1. **Deployment Logs:**
   - Check for errors after each deployment
   - Monitor API response times
   - Watch for database connection issues

2. **Beta Tester Activity:**
   - How many users signed up?
   - What features are they using?
   - Any crash reports?

3. **Performance:**
   - Page load times
   - AI meal generation speed
   - Database query performance

### **Replit Analytics:**

Your deployment includes analytics:
- Visit count
- Response times
- Error rates
- Resource usage

Access in: Deployment → Analytics tab

---

## 🚨 TROUBLESHOOTING

### **Staging deployment failed:**
- Check deployment logs for errors
- Verify all environment variables are set
- Ensure database is accessible
- Check that build completed successfully

### **Features work in dev but not staging:**
- Compare environment variables
- Check API keys are correct
- Verify database schema is up to date
- Check CORS settings if applicable

### **Staging is slow:**
- Increase machine size in deployment settings
- Check database performance
- Optimize API calls
- Consider caching strategies

### **Beta testers can't access:**
- Verify deployment is running
- Check custom domain DNS settings
- Ensure no IP blocking
- Verify SSL certificate is active

---

## 🎯 WHEN TO MOVE TO PRODUCTION

**Don't rush to production!** Move to Stage 3 when:

✅ All critical features work perfectly in staging  
✅ Beta testers report no major bugs  
✅ Performance is acceptable  
✅ Stripe integration tested thoroughly  
✅ You're comfortable with the user experience  
✅ Legal/compliance ready (privacy policy, terms)  
✅ App Store submission materials ready  

**Target:** January 2025 (per your plan)

---

## 📞 NEED HELP?

If you need assistance with:
- Setting up staging deployment
- Configuring custom domains
- Managing beta testers
- Troubleshooting deployment issues

Just ask! The agent can guide you through each step.

---

**Remember: Professional software companies use this exact workflow. You're building like the pros!** 🚀
