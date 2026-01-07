# My Perfect Meals - Grok Context Guide

## Project Overview
React/Vite + Express + Capacitor iOS meal planning app with AI-powered meal generation.

## Evolution Timeline
1. **Foundation** - React + Express monorepo, PostgreSQL with Drizzle ORM
2. **AI Integration** - OpenAI GPT-4 for meal generation, DALL-E 3 for images
3. **Subscription System** - Stripe for web, StoreKit 2 for iOS in-app purchases
4. **Meal Builders** - Multiple specialized builders (Diabetic, GLP-1, Anti-Inflammatory, Competition)
5. **Starch Strategy** - Core behavioral coaching: fibrous carbs (unlimited) vs starchy carbs (managed)
6. **ProCare** - Professional coach/clinician dashboard for client management
7. **iOS Native** - Capacitor wrapper with native sharing, StoreKit, geolocation
8. **Share + Translate** - Native share sheets + UI-level translation to device language

## Bundle Contents

### 1-copilot-ai.zip (21KB) - AI Conversation System
- ChefAssistant.tsx - Main AI chat component
- ConversationPanel.tsx - Chat UI with voice support
- mealEngineApi.ts - API calls to meal generation
- unifiedMealPipeline.ts - Server-side AI orchestration

### 2-pricing-stripe.zip (22KB) - Payments
- storekit.ts - iOS StoreKit 2 integration
- iosProducts.ts - iOS product definitions
- stripe.ts - Stripe webhook handlers
- schema.ts - Database schema with subscription fields

### 3-share-translate.zip (10KB) - Share + Translate Features
- ShareRecipeButton.tsx - Native OS share (Capacitor for iOS, Web Share API)
- TranslateToggle.tsx - UI translation with caching
- MealCardActions.tsx - Reusable wrapper
- translate.ts - OpenAI translation endpoint

### 4-core-entry.zip (57KB) - Core Application
- main.tsx - React entry point
- App.tsx - Root component with providers
- AuthContext.tsx - Authentication state management
- index.ts - Express server entry
- routes.ts - All API route registrations
- package.json - All dependencies

### 5-ios-capacitor.zip (8KB) - iOS Native
- capacitor.config.ts - Capacitor configuration
- Info.plist - iOS app settings
- AppDelegate.swift - iOS app delegate
- Podfile - iOS dependencies
- platform.ts - Platform detection utility

## Key Architectural Patterns

### Authentication
- Session-based auth with Passport.js
- Guest mode for Apple App Review (no sign-in required)
- ProCare clients managed by coaches

### AI Generation Flow
```
User Request → ChefAssistant → mealEngineApi → /api/meals/generate → unifiedMealPipeline → OpenAI → Response
```

### Share Flow (iOS)
```
ShareRecipeButton → Capacitor.isNativePlatform() → Share.share() → iOS Native Share Sheet
```

### Translation Flow
```
TranslateToggle → /api/translate → OpenAI GPT-4o-mini → Cache by content hash → Display
```

## Environment Variables Required
```
DATABASE_URL=           # PostgreSQL connection
OPENAI_API_KEY=         # OpenAI API for AI features
STRIPE_SECRET_KEY=      # Stripe payments (optional)
SESSION_SECRET=         # Session encryption
```

## Current Issue Being Debugged
**Share button not working on iOS native app** - Works on web, but not in Capacitor iOS build. 
Likely cause: `npx cap sync ios` needed after adding @capacitor/share plugin, then rebuild in Xcode.
