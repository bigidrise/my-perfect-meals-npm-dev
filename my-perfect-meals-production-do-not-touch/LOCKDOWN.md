# 🔒 CODEBASE LOCKDOWN MANIFEST

## PURPOSE
This document establishes **absolute stability** for My Perfect Meals application. All features listed below are **LOCKED** and require explicit approval before any modifications.

---

## 🚨 LOCKDOWN RULES

### **MANDATORY APPROVAL WORKFLOW**
1. **Agent MUST ask for approval** before making ANY changes to locked features
2. **User explicitly approves** unlocking the specific feature
3. Agent makes changes only to approved features
4. Agent asks user to re-lock after changes complete
5. **NO EXCEPTIONS** - no random fixes, no surprise modifications, no side-effects

### **VIOLATION POLICY**
If a locked feature breaks unexpectedly, the agent has violated lockdown protocol. User will be informed immediately and rollback options will be provided.

---

## 🔐 LOCKED FEATURES (PRODUCTION-READY)

### **MEAL PLANNING FEATURES**
- ✅ Weekly Meal Board (all meal types: breakfast, lunch, dinner, snacks)
- ✅ Beach Body Meal Board (event prep lean-out system)
- ✅ Diabetic Hub (blood sugar management meal planning)
- ✅ GLP-1 Hub (medication-optimized meal planning)
- ✅ Fridge Rescue (AI meal generation from available ingredients)
- ✅ Premade Meals (breakfast, lunch, dinner, snacks - all dietary types)
- ✅ Builder Plan System (custom meal plan creation)

### **AI MEAL GENERATION** 🔒
- ✅ AI Meal Creator Modal (4-step creation process) - **LOCKED November 24, 2025**
- ✅ AI Premade Picker (breakfast, lunch, dinner, snacks) - **LOCKED November 24, 2025**
- ✅ Snack Systems (all ingredient catalogs and pickers) - **LOCKED November 24, 2025**
- ✅ Craving Creator (locked per user explicit demand - "don't touch it ever again")
- ✅ Macro Targeting System (custom macro controls)
- ✅ Medical Badge System (safety validation)
- ✅ Unified Meal Engine Service (backend AI orchestration)
- ✅ **Unified Meal Pipeline** (`server/services/unifiedMealPipeline.ts`) - **LOCKED December 8, 2025**
  - Canonical endpoint: `/api/meals/generate`
  - Deterministic fallbacks when OpenAI unavailable
  - Guaranteed image URLs (DALL-E or fallback)
  - MealType normalization (handles "snacks" → "snack")
  - **Cache validation** - validates BOTH imageUrl AND ingredients before using cached meals
  - Stale cache entries automatically regenerated (prevents empty data display)
  - Production-stable for App Store submission

**CRITICAL MEAL PICKER FILES (ABSOLUTELY LOCKED):**
- `client/src/components/modals/AIMealCreatorModal.tsx` - NO UI structure changes
- `client/src/components/pickers/MealPremadePicker.tsx` - NO UI structure changes
- `server/services/unifiedMealPipeline.ts` - CORE PIPELINE - NO MODIFICATIONS
- `client/src/data/snackIngredients.ts` - Data additions allowed via registry pattern
- `client/src/data/diabeticPremadeSnacks.ts` - Data additions allowed via registry pattern

**APPROVED CHANGE TYPES:**
- ✅ **DATA ADDITIONS ONLY:** Adding new snack items (GLP-1, etc.) to dedicated data modules
- ❌ **LOGIC CHANGES:** Modifying picker UI structure, adding new sections, changing modal layout
- ❌ **FEATURE ADDITIONS:** New banners, displays, input fields, or any extra UI sections

**SAFE EXTENSION PATTERN:**
For adding GLP-1 snacks or other new food items:
1. Create dedicated data file: `client/src/data/glp1Snacks.ts`
2. Export typed array following existing snack structure
3. Import into existing registry/picker WITHOUT modifying picker logic
4. Test that picker renders new items without UI changes
5. Run verification: `./scripts/verify-meal-pickers.sh` (should pass without hash updates)

**THREE-LAYER PROTECTION SYSTEM:**
1. **Documentation Layer**: This LOCKDOWN.md file with explicit rules
2. **Code Banner Layer**: Lock warnings at top of protected files
3. **Automated Verification Layer**: SHA256 checksum validation

**AUTOMATED VERIFICATION:**
- Lock file: `scripts/checksums/meal_pickers.lock` (canonical hashes)
- Verify script: `./scripts/verify-meal-pickers.sh` (check for violations)
- Regenerate script: `./scripts/generate-meal-picker-checksums.sh` (architect-approved changes only)

**How to verify structure integrity:**
```bash
./scripts/verify-meal-pickers.sh
```

**When to regenerate checksums (requires architect approval):**
```bash
./scripts/generate-meal-picker-checksums.sh
```
Only run this after architect has reviewed and approved structural changes!

### **TRACKING & ANALYTICS**
- ✅ Macro Calculator (daily macro tracking)
- ✅ Biometrics System (body stats, weight tracking)
- ✅ Meal Logging (breakfast, lunch, dinner, snacks)
- ✅ Food Logging (individual food items)
- ✅ Dual-Write Weight Tracking (server-as-truth system)

### **NAVIGATION & UI**
- ✅ Dashboard (extended, compact, mobile-optimized versions)
- ✅ Planner Hub (meal planning feature navigation)
- ✅ Wellness Hub (men's/women's health navigation)
- ✅ Router System (all routes and navigation)
- ✅ Glass Treatment Package (UI design system)

### **USER MANAGEMENT**
- ✅ Authentication System (LocalStorage-based accounts)
- ✅ Onboarding Flow (health data collection)
- ✅ Profile Management
- ✅ Feature Access Control (subscription tiers)

### **SHOPPING & MEAL PREP**
- ✅ Shopping List System
- ✅ Meal Plan Archive
- ✅ Recipe Management

### **HEALTH HUBS**
- ✅ Clinical Lifestyle Hub (therapeutic diets)
- ✅ Medical Diets Hub (surgical/recovery protocols)
- ✅ Hormone Optimization (life stages)

### **PAYMENT & SUBSCRIPTION**
- ✅ Stripe Integration (checkout, subscriptions, webhooks)
- ✅ Subscription Management

### **GAMIFICATION**
- ✅ Ingredients Tetris Game
- ✅ Macro Match Game
- ✅ Game Audio System

### **ADVANCED FEATURES**
- ✅ Voice Concierge System (voice commands, transcription)
- ✅ Reminder Engine (smart notifications)
- ✅ Tutorial Hub (video tutorials)
- ✅ PWA Configuration (home screen installation)

### **COPILOT SYSTEM (Phase B Complete)**
- ✅ Hub-First Routing (7 hubs, 17 sub-options)
- ✅ Canonical Alias Registry (35 verified routes)
- ✅ Keyword Matching System (token-level fallback)
- ✅ Voice Navigation (direct pages + hub prompts)
- ✅ Sub-Option Selection Logic
- 🔒 **LOCKED:** See PHASE_B_COPILOT_LOCK.md for complete lockdown details

### **WALKTHROUGH SYSTEM (Simplified - November 30, 2025)**
- ✅ **Quick Tour System** - Simple, stable modal-based page guidance
  - `useQuickTour` hook (localStorage-gated, auto-show on first visit)
  - `QuickTourModal` component (Glass-styled, numbered steps)
  - `QuickTourButton` component (header help icon)
- ✅ **Pages with Quick Tour:**
  - Weekly Meal Board
  - Beach Body Meal Board
  - Diabetic Hub
  - GLP-1 Hub
  
**DEPRECATED WALKTHROUGH SYSTEMS:**
- ❌ `usePageWalkthrough` hook - DEPRECATED, causes stability issues
- ❌ `SimpleWalkthrough` system - LEGACY, bypasses guards
- ❌ Spotlight Walkthrough Integration - RETIRED for simplicity

**QUICK TOUR DESIGN PRINCIPLES:**
1. localStorage-gated (shows once, remembers "Don't show again")
2. No Copilot dependency (works independently)
3. Manual access via help button in header
4. 3-6 numbered steps per page
5. Glass-styled modal matching app design

---

## 🧊 QUARANTINED FEATURES (OBSOLETE - DO NOT ACTIVATE)
Located in `/client/src/pages/_quarantine/`:
- Restaurant Guide
- Meal Finder
- Craving Hub (old version)
- Alcohol Hub
- OnboardingV2-backup.tsx - Old onboarding implementation
- MedicalDietsHub.tsx - Not in active navigation
- PatientAssignmentDashboard.tsx - Unused physician feature
- DiabeticSupportHub.tsx - Redundant with DiabeticHub
- onboarding-ai-voice-journal.tsx - Old onboarding step
- onboarding-foods-to-avoid.tsx - Old onboarding step
- onboarding-meal-reminders.tsx - Old onboarding step
- onboarding-phone-consent.tsx - Old onboarding step

**RULE:** These features are permanently quarantined. Do not activate, modify, or reference. All imports to quarantined files have been removed from Router.tsx.

---

## 🔮 FUTURE FEATURES (NOT YET LAUNCHED)
Located in `/client/src/pages/_future/`:
- Trainer Dashboard
- Client Management
- Doctor Portal
- Advanced Analytics

**RULE:** These features are locked for future launch. Do not activate until user explicitly requests.

---

## 🎯 ACTIVE DEVELOPMENT ZONE

### **CURRENTLY UNLOCKED FOR WORK:**
- ❌ NONE - All systems locked after Phase B completion

### **RECENTLY COMPLETED & LOCKED:**
- ✅ **Phase B Copilot System** (November 23, 2025)
  - Hub-first routing system
  - Canonical alias registry (35 routes)
  - Spotlight walkthrough integration
  - Voice navigation improvements
  - See PHASE_B_COPILOT_LOCK.md for full details

**RULE:** ALL Copilot subsystem files are now LOCKED. No modifications permitted until explicit Phase C unlock.

---

## 📋 CHANGE REQUEST PROCESS

### **How to Request Unlock:**
1. User identifies specific feature needing changes
2. User explicitly states: "Unlock [FEATURE NAME] for changes"
3. Agent confirms unlock and proceeds with modifications
4. Agent completes work and requests re-lock
5. User approves re-lock

### **Emergency Fixes:**
If a locked feature has a critical bug:
1. Agent identifies the issue and reports to user
2. Agent requests emergency unlock for that specific feature only
3. User approves emergency unlock
4. Agent fixes ONLY the reported issue
5. Agent requests re-lock immediately

---

## 🚀 DEPLOYMENT ZONES

### **ZONE 1: DEVELOPMENT (This Workspace)**
- Current Replit workspace
- All changes happen here first
- Full testing before deploying to staging

### **ZONE 2: STAGING (Beta Testing)**
- Separate deployment for beta testers
- Trainers, doctors, clients test here
- Real-world testing of features
- See DEPLOYMENT_GUIDE.md for setup

### **ZONE 3: PRODUCTION (Future - January 2025)**
- Public App Store release
- Only tested, stable code
- See DEPLOYMENT_GUIDE.md for workflow

---

## 📊 LOCKDOWN EFFECTIVENESS

### **PROTECTED AGAINST:**
- ✅ Random feature breakages
- ✅ Unintended side-effects from other work
- ✅ Agent "fixing" wrong files
- ✅ Schema mismatches from unauthorized changes
- ✅ UI regressions
- ✅ Feature overwrites

### **ALLOWS:**
- ✅ Explicit, controlled changes to specific features
- ✅ Emergency bug fixes with approval
- ✅ Focused development on approved features
- ✅ Clean git history
- ✅ Stable beta testing environment

---

## 🔥 LAST UPDATED
**Date:** November 30, 2025  
**Status:** Complete codebase lockdown active + Physical quarantine enforced + Database schema aligned  
**Active Work:** NONE - all systems locked  
**Recent Completions:**
- Physical quarantine of deprecated files (8 files moved to _quarantine folder)
- Database schema alignment: Added missing `birthday` column to users table (fixed daily reminder cron error)

---

**Remember: Stability is the foundation of a successful launch. Every feature that's locked is a feature that won't break unexpectedly.**
