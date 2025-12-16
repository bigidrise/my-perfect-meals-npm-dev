# Stripe Integration Setup Guide

This guide walks you through setting up Stripe checkout and subscription management for My Perfect Meals.

## Overview

The app uses Stripe's **lookup_key** pattern to automatically fetch the correct Price IDs. This means:
- ✅ No hardcoded Price IDs in environment variables
- ✅ Automatic price fetching via lookup_key
- ✅ Easy to update prices in Stripe Dashboard
- ✅ No code changes needed when prices change

## Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **Stripe CLI** (optional): For webhook testing locally

## Step 1: Create Products & Prices in Stripe Dashboard

### Consumer Plans

Create these Products with corresponding Prices:

1. **Basic** - $9.99/month
   - Price lookup_key: `mpm_basic_monthly`
   
2. **Upgrade** - $19.99/month
   - Price lookup_key: `mpm_upgrade_monthly`
   - Badge: "Popular"
   
3. **Upgrade (Beta Lock)** - $9.99/month
   - Price lookup_key: `mpm_upgrade_beta_monthly`
   - **Hidden from public** (for private beta users)
   
4. **Ultimate** - $29.99/month
   - Price lookup_key: `mpm_ultimate_monthly`

### Family Plans

5. **Family Base** - $29.99/month
   - Price lookup_key: `mpm_family_base_monthly`
   - Description: "Includes up to 4 profiles"
   
6. **Family All-Upgrade** - $44.99/month
   - Price lookup_key: `mpm_family_all_upgrade_monthly`
   - Description: "All 4 seats include Upgrade features"
   
7. **Family All-Ultimate** - $74.99/month
   - Price lookup_key: `mpm_family_all_ultimate_monthly`
   - Description: "All 4 seats include Ultimate features"

### Pro Plans

8. **ProCare** - $49.99/month
   - Price lookup_key: `mpm_procare_monthly`
   - Description: "Doctors/trainers toolkit with client linking"

## Step 2: Set Lookup Keys in Stripe

For each Price you created:

1. Go to **Products** → Select the product
2. Click on the **Price** 
3. Scroll to **Lookup key** field
4. Enter the exact lookup_key from the list above
5. Click **Save**

**Important**: The lookup_key must match exactly as shown above.

## Step 3: Get Your Stripe API Keys

1. Go to **Developers** → **API keys**
2. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
3. Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)

## Step 4: Set Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here

# Stripe Checkout URLs
APP_SUCCESS_URL=http://localhost:5000/checkout/success
APP_CANCEL_URL=http://localhost:5000/pricing?cancel=1

# Frontend Stripe Configuration
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_publishable_key_here
```

## Step 5: Configure Webhooks (Production)

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL: `https://your-domain.com/api/stripe/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to your `.env` as `STRIPE_WEBHOOK_SECRET`

## Step 6: Test Local Webhooks (Development)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5000/api/stripe/webhook

# Copy the webhook signing secret from the output
# Add it to your .env as STRIPE_WEBHOOK_SECRET
```

## Step 7: Verify Price IDs (Optional)

Run this script to verify all lookup_keys are set correctly:

```bash
# Create a file: tools/verify-stripe-prices.ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-09-30.clover" });

const LOOKUP_KEYS = [
  "mpm_basic_monthly",
  "mpm_upgrade_monthly",
  "mpm_upgrade_beta_monthly",
  "mpm_ultimate_monthly",
  "mpm_family_base_monthly",
  "mpm_family_all_upgrade_monthly",
  "mpm_family_all_ultimate_monthly",
  "mpm_procare_monthly",
];

(async () => {
  for (const key of LOOKUP_KEYS) {
    const prices = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
    const price = prices.data[0];
    if (price) {
      console.log(`✓ ${key}: $${(price.unit_amount ?? 0) / 100}/mo`);
    } else {
      console.log(`✗ ${key}: NOT FOUND`);
    }
  }
})();
```

Run it:
```bash
STRIPE_SECRET_KEY=sk_test_xxx ts-node tools/verify-stripe-prices.ts
```

## Step 8: Test Checkout Flow

1. Start your app: `npm run dev`
2. Navigate to `/pricing`
3. Click any plan button
4. Should redirect to Stripe Checkout
5. Use test card: `4242 4242 4242 4242`
6. Complete checkout
7. Should redirect to success page

## Production Checklist

Before going live:

- [ ] Switch to **Live mode** API keys in Stripe Dashboard
- [ ] Update `.env` with `sk_live_` and `pk_live_` keys
- [ ] Configure production webhook endpoint
- [ ] Test checkout with real card
- [ ] Enable **Customer Portal** in Stripe Dashboard (Settings → Billing)
- [ ] Set up tax collection (if applicable)
- [ ] Review subscription settings (trial periods, grace periods)

## Troubleshooting

### "Invalid lookup_key" error
- Check that lookup_key in Stripe Dashboard matches exactly
- Verify Price is **active** (not archived)

### Webhook not receiving events
- Check webhook signing secret is correct
- Verify endpoint URL is publicly accessible
- Check webhook event selections in Stripe Dashboard

### Test card declined
- Use test cards from [Stripe Testing](https://stripe.com/docs/testing)
- Most common: `4242 4242 4242 4242` (Visa)

## Support

- **Stripe Docs**: https://stripe.com/docs
- **Test Cards**: https://stripe.com/docs/testing
- **API Reference**: https://stripe.com/docs/api
