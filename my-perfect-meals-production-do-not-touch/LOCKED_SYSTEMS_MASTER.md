# 🔒 MASTER LOCK FILE - ALL PROTECTED SYSTEMS
## Status: PRODUCTION LOCKED - DO NOT MODIFY
## Date: January 8, 2025
## Authority: User Explicit Request - "Lock down all working systems"

## 🚨 CRITICAL WARNING
These systems are PERMANENTLY LOCKED and PROTECTED. The user has explicitly demanded they remain untouched to prevent breaking working functionality.

---

## 1. 🔒 AVATAR & VOICE SYSTEM 
**File: LOCKED_AVATAR_VOICE_SYSTEM.md**
- ✅ Chef avatar with automatic show/hide (10-second timer)
- ✅ Orange chef hat shortcut (24px) at top right
- ✅ iOS voice button (24px) next to chef hat - MOVED FROM BOTTOM
- ✅ Full voice transcription with OpenAI Whisper
- ✅ Voice command parsing with GPT-4o
- ✅ ElevenLabs speech synthesis responses
- ✅ Navigation via voice commands
- ✅ Hardcoded command patterns for instant responses

**PROTECTED ROUTES:**
- `/api/voice/transcribe` - OpenAI Whisper transcription
- `/api/voice/parse` - Voice command parsing with VoiceCommandParser

**PROTECTED FILES:**
- `client/src/components/AvatarSelector.tsx`
- `client/src/components/TapToRecordButton.tsx`
- `server/voiceCommandParser.ts`
- `server/routes.ts` (voice endpoints)

---

## 2. 🔒 BLOOD SUGAR & GLYCEMIC SYSTEM
**File: LOCKED_BLOOD_SUGAR_SYSTEM.md**
- ✅ Blood glucose input (70-400 mg/dL validation)
- ✅ Preferred carbohydrate selection
- ✅ Portion size controls (0.5x to 2.0x)
- ✅ PostgreSQL persistence with Drizzle ORM
- ✅ Medical personalization integration

**USER DEMAND:** "I'm gonna be pissed off" if modified - PERMANENTLY LOCKED

**PROTECTED ROUTES:**
- `/api/glycemic-settings` (GET/POST)

**PROTECTED FILES:**
- `client/src/pages/LowGlycemicCarbSelectionPage.tsx`
- `shared/schema.ts` (glycemicSettings table)
- `server/storage.ts` (glycemic functions)

---

## 3. 🔒 MEAL LOGGING SYSTEM
**File: LOCKED_MEAL_LOGGING_SYSTEM.md**
- ✅ PostgreSQL persistence with proper indexing
- ✅ Intelligent time parsing ("8:30 AM", "breakfast time")
- ✅ Auto-summarization for long descriptions
- ✅ Infinite scroll pagination
- ✅ Calendar view with meal indicators
- ✅ CSV export functionality
- ✅ Historical data protection ("Clear Today" only)
- ✅ Chronological sorting by meal time

**PROTECTED ROUTES:**
- `/api/meal-logs` (GET/POST)
- `/api/meal-logs/today` (DELETE)
- `/api/meal-summarize` (POST)

**PROTECTED FILES:**
- `client/src/pages/log-meals.tsx`
- `client/src/pages/MealJournalPage.tsx`
- `client/src/hooks/useMealLogsInfinite.ts`
- `client/src/components/MealJournalCalendar.tsx`
- `client/src/lib/exportMealLogsCsv.ts`
- `server/routes/mealLogs.ts`
- `server/routes/mealSummarize.ts`

---

## 4. 🔒 WATER TRACKING SYSTEM
**File: LOCKED_WATER_SYSTEM.md**
- ✅ PostgreSQL persistence with unit conversion
- ✅ Simple state management (mirrors meal pattern)
- ✅ Direct API calls without React Query mutations
- ✅ Two-column layout with immediate feedback
- ✅ Quick amount buttons (8oz, 16oz, etc.)
- ✅ Optional time entry with parsing
- ✅ Console logging for debugging

**PROTECTED ROUTES:**
- `/api/water-logs` (GET/POST)
- `/api/water-logs/today` (DELETE)

**PROTECTED FILES:**
- `client/src/pages/LogWaterPage.tsx`
- `client/src/pages/WaterJournalPage.tsx`
- `server/routes/waterLogs.ts`
- `shared/schema.ts` (waterLogs table)

---

## 5. 🔒 DATABASE SCHEMA
**File: shared/schema.ts**
- ✅ `mealLogs` table with proper indexing
- ✅ `glycemicSettings` table with user preferences
- ✅ Drizzle ORM integration
- ✅ PostgreSQL compatibility

---

## 6. 🔒 MACRO CALCULATOR SYSTEM
**File: LOCKED_MACRO_CALCULATOR_SYSTEM.md**
- ✅ Macro Calculator Page (`client/src/pages/MacroCounter.tsx`) - Critical rendering rules enforced ✅
- ✅ Render Guards: Goal Card, Body Type Card, Details Card MUST always render
- ✅ Lockdown Doc: `MACRO_CALCULATOR_LOCKDOWN.md`

---

## ⚠️ ENFORCEMENT RULES

### ABSOLUTELY FORBIDDEN:
1. **Moving iOS voice button back to bottom** - User specifically requested top right
2. **Making voice button larger** - User requested smaller (24px) for mobile space
3. **Adding microphone back to chef** - User explicitly removed it
4. **Modifying blood sugar system** - User threatened consequences
5. **Breaking meal logging persistence** - Complex system working perfectly
6. **Changing voice command processing** - Full flow now functional
7. **Conditionally rendering Macro Calculator cards** - Must always render

### MODIFICATION POLICY:
- **NEVER modify locked files without explicit user permission**
- Create NEW components instead of changing locked ones
- Any changes must be approved by user in advance
- Test changes in isolation before integration

### TESTING CONFIRMATION:
✅ All systems tested and working as of January 8, 2025
✅ Voice: "How do I get to the woman's health?" → Correctly processed
✅ Navigation via voice commands functional
✅ Meal logging with persistence confirmed
✅ Blood sugar input system operational
✅ Avatar system with proper timers working
✅ Macro Calculator rendering confirmed

---

## 📋 QUICK REFERENCE

**Working Voice Flow:**
1. User taps blue button (top right)
2. Records audio with MediaRecorder
3. Sends to `/api/voice/transcribe` (Whisper)
4. Processes with `/api/voice/parse` (GPT-4o)
5. Chef speaks response (ElevenLabs)
6. Navigates to requested page

**Protected UI Elements:**
- Orange chef hat button (top right, 24px)
- Blue iOS voice button (next to chef hat, 24px)
- Blood glucose input field and validation
- Meal logging forms and journal views
- Chef avatar with inactivity timer
- Macro Calculator Goal Card
- Macro Calculator Body Type Card
- Macro Calculator Details Card

---

## 🔒 LOCK STATUS: PERMANENT
These systems are now PRODUCTION READY and LOCKED for stability.