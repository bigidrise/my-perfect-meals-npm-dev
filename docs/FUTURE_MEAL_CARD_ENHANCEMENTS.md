# Future Meal Card Enhancements

This document outlines planned enhancements for the meal card sharing and translation features. These are deferred for future implementation phases.

## Phase 2: Growth Accelerators

### 1. Screenshot Watermarking

**Purpose:** Add branding watermark to shared meal screenshots.

**Implementation Notes:**
- Capture meal card as image using html-to-image or html2canvas (already installed)
- Add watermark overlay with My Perfect Meals logo
- Position: Bottom-right corner, semi-transparent
- Include app name and optional tagline
- Maintain image quality for social sharing

**Files to Modify:**
- `client/src/components/ShareRecipeButton.tsx` - Add image share option
- Create `client/src/utils/watermark.ts` - Watermarking utility

**Considerations:**
- iOS share sheet supports both text and images
- Web share API image support varies by browser
- Fallback: Share text + watermarked image download

### 2. Invite/Referral Code Injection

**Purpose:** Include referral codes in shared content to drive organic growth.

**Implementation Notes:**
- Append referral link to share text
- Format: "Try it free: myperfectmeals.com/ref/CODE123"
- Track referrals server-side
- Link code to user account for attribution

**Files to Modify:**
- `client/src/components/ShareRecipeButton.tsx` - Include ref code in shareText
- `server/routes/referrals.ts` - Create referral tracking endpoint
- `shared/schema.ts` - Add referrals table

**Backend Changes Needed:**
- Generate unique referral codes per user
- Track referral clicks and conversions
- Reward system integration (future)

### 3. Language Picker for Translation

**Purpose:** Allow users to translate to any language, not just device language.

**Implementation Notes:**
- Add dropdown/picker to TranslateToggle component
- Popular languages: Spanish, French, German, Chinese, Japanese, Korean
- Store preferred language in user preferences
- Show language name in button when translated

**Files to Modify:**
- `client/src/components/TranslateToggle.tsx` - Add language selector
- `server/routes/translate.ts` - Already supports any target language

**UI Considerations:**
- Keep UI minimal - icon button with dropdown
- Remember last selected language
- Quick-switch between original and translated

## Current Implementation (Phase 1)

### Completed Features:
1. **Native Share Button** - Replaces Copy button
   - Uses Capacitor Share plugin for iOS native share sheet
   - Falls back to Web Share API for browsers
   - Final fallback to clipboard copy

2. **Translate Toggle** - UI-level translation
   - Translates to device language automatically
   - Caches translations to avoid repeat API calls
   - Toggle between original and translated text
   - Uses OpenAI GPT-4o-mini for translation

### Components Created:
- `client/src/components/ShareRecipeButton.tsx`
- `client/src/components/TranslateToggle.tsx`
- `client/src/components/MealCardActions.tsx` - Reusable container
- `server/routes/translate.ts` - Translation API endpoint

### Integration Points:
All meal cards and builders now use MealCardActions:
- MealCard.tsx (weekly meal board)
- craving-creator.tsx
- fridge-rescue.tsx
- CravingPresets.tsx
- CravingDessertCreator.tsx
- toddlers-meals-hub.tsx
- kids-meals-hub.tsx
- AlcoholLeanAndSocial.tsx
- mocktails-low-cal-mixers.tsx

---
Last Updated: January 2026
