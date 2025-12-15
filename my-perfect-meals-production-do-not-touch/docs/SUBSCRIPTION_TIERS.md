# My Perfect Meals - Subscription Tier Structure

## Business Philosophy

**Core Insight:** Most apps give you basic logging, then charge more for features. My Perfect Meals flips this:

- **Basic ($9.99)** gives MORE than competitors charge for
- **Premium ($19.99)** is where users WANT to live - all the lifestyle features that make the app indispensable
- **Ultimate ($29.99)** is for short-term professional/event use

**The Stickiness Factor:** Even if someone stops actively dieting, they keep Premium because the lifestyle features (restaurants, cravings, kids meals, nightlife) are useful in everyday life.

---

## Tier Breakdown

### Basic Tier - $9.99/month
*"Everything other apps charge for, plus more"*

**ONE Meal Builder** (assigned at signup based on health profile):
| Health Profile | Assigned Builder |
|----------------|------------------|
| Regular dieter | Weekly Meal Board |
| Diabetic | Diabetic Meal Builder |
| GLP-1 medication user | GLP-1 Meal Builder |
| Anti-inflammatory needs | Anti-Inflammatory Builder |

**Note:** Users do NOT switch between these. Your health determines your builder. People eat a certain way, and they always need to eat that way.

**Also Included:**
- Daily Macro Calculator
- Supplement Hub
- Biometrics Tracking
- Daily Health Journal
- Basic meal logging

---

### Premium Tier - $19.99/month
*"Where we WANT users to live"*

**Everything in Basic, PLUS all lifestyle features:**

**Food Discovery & Creation:**
- Craving Creator
- Dessert Creator
- Premade Meals (all categories)
- Fridge Rescue (AI meals from available ingredients)

**Lifestyle Hubs:**
- Restaurant Guide
- Kids Meals Hub
- Nightlife/Alcohol Hub
- Mocktails

**Future Additions (planned):**
- Camping Hub
- Fast Food Hub
- Potluck Hub
- And more lifestyle features

**Why Premium is "sticky":**
Even if users stop actively dieting, they keep Premium because:
- They still eat at restaurants
- They still have cravings
- They still feed their kids
- They still go out at night
- These features are useful for LIFE, not just dieting

---

### Ultimate Tier - $29.99/month
*"Professional & Event Features - Temporary Use"*

**Everything in Premium, PLUS three special builders:**

1. **Beach Body Builder**
   - For event preparation (wedding, vacation, reunion)
   - Typical use: 2-3 months
   - Then drop back to Premium

2. **ProCare Professional**
   - Working with a trainer OR doctor
   - Two variants: Trainer version, Doctor version
   - Requires professional assignment

3. **Competition/Pro Physique Builder**
   - For competition preparation
   - Bodybuilding, physique shows, sports performance

**Business Model:**
- Users upgrade to Ultimate for a specific goal/event
- Work with a coach for 2-3 months
- Achieve their goal
- Drop back to Premium ($19.99) for ongoing lifestyle use

---

## Meal Builder Assignment Rules

### Health-Based Assignment (Basic/Premium)
1. User completes onboarding health profile
2. System assigns ONE meal builder based on:
   - Diabetes status → Diabetic Builder
   - GLP-1 medication → GLP-1 Builder
   - Anti-inflammatory conditions → Anti-Inflammatory Builder
   - None of the above → Weekly Meal Board

### Rules:
- **No switching for mood** - Users don't bounce between builders
- **Health determines diet** - If you're diabetic, you eat diabetic. Period.
- **Change requires health update** - Only way to switch is if health profile changes

### Professional Override (Ultimate)
- Trainer/Doctor can assign ProCare builder
- This becomes the active builder during coaching period
- User retains access to their health-based builder

---

## Feature Access Matrix

| Feature | Basic | Premium | Ultimate |
|---------|-------|---------|----------|
| ONE Health-Based Meal Builder | ✓ | ✓ | ✓ |
| Daily Macro Calculator | ✓ | ✓ | ✓ |
| Supplement Hub | ✓ | ✓ | ✓ |
| Biometrics Tracking | ✓ | ✓ | ✓ |
| Daily Health Journal | ✓ | ✓ | ✓ |
| Craving Creator | | ✓ | ✓ |
| Dessert Creator | | ✓ | ✓ |
| Premade Meals | | ✓ | ✓ |
| Fridge Rescue | | ✓ | ✓ |
| Restaurant Guide | | ✓ | ✓ |
| Kids Meals Hub | | ✓ | ✓ |
| Nightlife/Alcohol Hub | | ✓ | ✓ |
| Beach Body Builder | | | ✓ |
| ProCare (Trainer/Doctor) | | | ✓ |
| Competition/Physique Builder | | | ✓ |

---

## UI Implementation

### Locked Features Display
For features above user's tier:
- Card opacity: 40%
- Icon opacity: 20%
- Title opacity: 40%
- Lock badge: top-right corner
- Button text: "Unlock Plan"
- Tap action: Show upgrade modal

### Active Builder Display
- Full color, fully tappable
- No lock badge
- Shows user's health-assigned builder

### Other Builders (Same Tier)
- Should not be shown as switchable options
- User doesn't choose between diabetic/GLP-1/etc.
- Assignment is automatic based on health

---

## For Apple App Store Submission

**Value Proposition:**
- Basic tier provides more value than competitor apps at the same price point
- Premium tier creates long-term engagement through lifestyle features
- Ultimate tier serves specific short-term professional needs

**Subscription Model:**
- 7-day free trial
- Monthly billing
- Users can upgrade/downgrade anytime
- Most users expected to settle at Premium tier

**Why This Works:**
1. Users get immediate value at Basic
2. Premium features are "sticky" - useful even when not actively dieting
3. Ultimate serves a specific purpose, then users naturally downgrade
4. Creates sustainable recurring revenue at the $19.99 sweet spot

---

## For Investors

**Key Metrics to Highlight:**
- Expected tier distribution: 20% Basic, 65% Premium, 15% Ultimate
- Premium retention expected to be high due to lifestyle features
- Ultimate churn is expected and healthy (users complete their goals)

**Competitive Advantage:**
- Other apps: Basic logging, pay more for features
- My Perfect Meals: Full value at Basic, irresistible lifestyle at Premium

---

## Last Updated
**Date:** December 3, 2025
**Status:** Official tier structure for App Store submission
