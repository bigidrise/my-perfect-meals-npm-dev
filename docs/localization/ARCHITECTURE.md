# My Perfect Meals — Global Localization Architecture

**Status:** Proposed — awaiting approval before bulk migration  
**Scope:** Platform-wide. All active surfaces, AI generation, clinical copy, layout resilience.  
**Grounding:** Step 1A (7,469 raw string findings) + Step 1B (690 files classified by reachability)  
**Real workload:** 1,439 hardcoded strings on active surfaces across 452 reachable files.

---

## Governing Principle

> **My Perfect Meals must operate in multiple locales, not be translated into multiple languages.**

This is the same distinction that separates a global iOS/Android application from a page-by-page translation project. Apple and Google do not translate app content — they provide platform infrastructure (locale detection, RTL layout, system formatting) while the app externalizes its own strings and supplies resources. The UI itself is designed to survive any language.

That is the standard this architecture adopts.

A component is not localization-complete when its strings have translations. It is complete when translated content can render without clipping, overlap, inaccessible controls, unreadable shrinking, or broken navigation — at our smallest supported mobile viewport, in Arabic RTL, and in long-text locales like German and Tagalog.

---

## What the Current Implementation Gets Right

The existing i18next setup is a sound foundation. Retain everything:

| Capability | Current status | Keep? |
|---|---|---|
| i18next + react-i18next | Installed, initialized | ✅ Yes |
| 14 locale JSON bundles | All bundled at build time | ✅ Yes |
| `resolveI18nLang()` helper | Handles auto-detect + device fallback | ✅ Yes |
| `document.documentElement.dir` on language change | RTL mechanism in place | ✅ Yes — extend it |
| `preferredLanguage` in DB + synced through AuthContext | One authoritative locale source | ✅ Yes |
| `fallbackLng: "en"` | Correct default | ✅ Yes |
| Namespace support | 27 named namespaces | ✅ Yes — expand |

---

## What Must Change

### 1. Locale initialization — load from user preference, not hardcoded `"en"`

**Current:** `i18n.init({ lng: "en" })` — always starts English regardless of user preference.

**Fix:** AuthContext already calls `i18n.changeLanguage()` after the user profile loads. The gap is the initial render before the profile arrives. Solution: read `localStorage.getItem("mpm_lang")` as the fast-start hint, confirm from the profile on load.

```ts
// client/src/i18n/index.ts — change init
lng: localStorage.getItem("mpm_lang") || "en",

// client/src/contexts/AuthContext.tsx — after profile loads
const resolved = resolveI18nLang(userData.preferredLanguage);
localStorage.setItem("mpm_lang", resolved);
i18n.changeLanguage(resolved);
```

### 2. Namespace structure — split locale files by surface domain

**Current:** Single JSON per locale with all keys merged. `en.json` has 1,918 keys in one file. Every namespace writes into the same object.

**Problem:** Unbounded growth, merge conflicts from task agents, no ownership boundary.

**Fix:** Migrate to one JSON file per namespace per locale. i18next lazy-loads namespaces on demand — reducing initial bundle size.

```
client/src/i18n/locales/
  en/
    common.json          ← shared UI primitives (buttons, labels, errors)
    mealCard.json        ← MealCard namespace
    dashboard.json       ← Dashboard
    clinical.json        ← clinical/safety strings (protected)
    ...
  es/
    common.json
    mealCard.json
    ...
```

This change can be done incrementally: the existing single-file structure stays until a namespace is migrated.

### 3. RTL — global application-level using what we already have

**Current:** `document.documentElement.dir = "rtl"` is set on language change — this is correct. The `<html dir>` attribute is the right hook.

**RTL capability audit result (no new dependency needed):**

Tailwind v3.4.19 ships `rtl:` and `ltr:` variants **natively** — no plugin required:
```tsx
// Works today without any plugin:
<div className="ml-4 rtl:ml-0 rtl:mr-4">
```

Additionally, `tailwindcss-rtl` is already installed in `node_modules/`. It is not needed and should not be added to `tailwind.config.ts` — Tailwind's built-in `rtl:` variant is the correct solution for v3.

**Two-layer approach using only what already exists:**

**Layer 1 — Tailwind `rtl:` variants (already available):**
```tsx
// Directional spacing — use rtl: to flip
<div className="ml-4 rtl:ml-0 rtl:mr-4">
<button className="pl-3 rtl:pl-0 rtl:pr-3">
```

**Layer 2 — CSS logical properties for new components (no Tailwind needed):**
```css
/* Preferred for new components — automatically correct in both directions */
margin-inline-start: 1rem;   /* not margin-left */
padding-inline-end: 0.5rem;  /* not padding-right */
```

**Migration rule:** Existing components get `rtl:` variants added during Batch A/B migration. New components use CSS logical properties from day one.

**What NOT to do:** Per-component `if (lang === 'ar')` conditionals. RTL must be declarative at the CSS level.

**Icons under RTL:** Directional icons (arrows, chevrons, back buttons) must mirror. Non-directional icons (stars, checkmarks, medical symbols) must not. Implement a `<DirectionalIcon>` wrapper that applies `scale-x-[-1]` under `dir=rtl` for arrow-type icons only.

### 4. Responsive layout — not designed around English dimensions

**Current:** Fixed-height containers, buttons that assume short English labels, modals that clip when text expands.

**Standard to adopt for all components going forward:**

```tsx
// ❌ Fragile — assumes English fits in 2 lines
<div className="h-16 overflow-hidden">

// ✅ Resilient
<div className="min-h-16">

// ❌ Button assumes short label
<button className="w-24 px-2">

// ✅ Button grows with content
<button className="px-4 py-2 min-w-[6rem]">
```

Rules:
- `min-h-*` instead of `h-*` for text containers
- `min-w-*` on buttons, not fixed `w-*`
- Modals and sheets must be scrollable, not clipped
- Navigation labels must wrap or truncate with ellipsis, not overflow
- Font size floor: never below `12px` on mobile regardless of translation length
- No `whitespace-nowrap` on user-facing strings in shared components

### 5. Locale-aware formatting — remove all hardcoded `"en-US"`

**Current:** Multiple files hardcode `toLocaleDateString("en-US", ...)`.

**Fix:** Introduce a shared formatting utility that reads from i18n:

```ts
// client/src/lib/locale.ts
import i18n from "@/i18n";

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString(i18n.language, opts ?? {
    month: "long", day: "numeric", year: "numeric"
  });
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(i18n.language, opts).format(n);
}

export function formatUnit(value: number, unit: "gram" | "kilogram" | "pound"): string {
  return new Intl.NumberFormat(i18n.language, { style: "unit", unit, unitDisplay: "short" }).format(value);
}
```

Files to update (hardcoded `"en-US"` found in Step 1 scan):
- `client/src/utils/week.ts`
- `client/src/components/partner-center/MonthlyMarketing.tsx`
- `client/src/pages/certification/CertificationComplete.tsx`
- `client/src/pages/academy/PlatformMasteryComplete.tsx`
- `client/src/pages/pro/TrainerClientDashboard.tsx`
- `client/src/pages/pro/CheckInOverviewPanel.tsx`
- `client/src/utils/midnight.ts`

### 6. Plural forms — use i18next count interpolation

**Current:** Raw JS conditionals (`count === 1 ? "day" : "days"`).

**Fix:** Use i18next plural suffixes — already partially in use (`count:` in TrialBanner, MealCard). Extend consistently:

```json
// en.json
"daysLeft": "{{count}} day left",
"daysLeft_other": "{{count}} days left"
```

```tsx
t("daysLeft", { count: daysLeft })
```

i18next handles language-specific plural rules automatically (Arabic has 6 plural forms; Russian has 3).

### 7. AI locale propagation — the missing global path

**Current:** `openaiSafe.ts` exists as a canonical wrapper but 30+ server files bypass it with their own OpenAI client instances. Language injection is per-service, not universal.

**Phased approach:**

**Phase 1 (safe, immediate):** Add a `languageInstruction()` utility to `server/utils/languageInstruction.ts` (already exists but underused). Audit all 30+ bypass routes and add language injection to each system prompt individually. This is tedious but safe.

**Phase 2 (architectural):** Consolidate all direct `new OpenAI()` instantiations into `openaiSafe.ts`. Add a `withLocale(prompt, req)` wrapper that prepends the language instruction to every system prompt. Routes pass `req` — the user's `preferredLanguage` is on `req.authUser`.

```ts
// server/utils/openaiSafe.ts — add to chatJson()
function withLocale(systemPrompt: string, preferredLanguage?: string): string {
  if (!preferredLanguage || preferredLanguage === "en") return systemPrompt;
  return `${getLanguageInstruction(preferredLanguage)}\n\n${systemPrompt}`;
}
```

**Files bypassing openaiSafe.ts** (30+ — require Phase 1 audit):
`groceryCoach.ts`, `mealRefinement.ts`, `cookingTutorials.routes.ts`, `getaway.ts`, `coaching/engine.ts`, `unifiedMealPipeline.ts`, `assistant_legacy.ts`, and ~24 others identified in Step 1B exploration.

### 8. Clinical/safety string protection

**The 130 clinical strings on active surfaces are a separate class.** They must never be bulk-automated.

**Clinical translation contract:**
1. All clinical strings live in a dedicated `clinical.json` namespace
2. Changes to clinical strings require a `[clinical-translation]` annotation in the PR
3. GATE_07 (git diff checker) blocks merge if clinical strings change without annotation
4. Translations are produced by qualified medical translators or reviewed by a clinician before merge
5. The `CLINICAL_SAFETY` classifier tag from Step 1A audits is the authoritative list

**Categories requiring clinical governance:**
- Diabetes / GLP-1 guidance
- Medication / dosing language
- Pregnancy / pediatric safety
- Allergy / contraindication warnings
- Lab value terminology

### 9. New feature compliance — the localization contract

Every new component must follow this contract. Enforced by GATE_01 (eslint-plugin-i18next).

```tsx
// ✅ Compliant component pattern
import { useTranslation } from "react-i18next";

export function MyNewComponent() {
  const { t } = useTranslation("myNamespace");
  return (
    <div>
      <h2>{t("title")}</h2>
      <p>{t("body")}</p>
      <button>{t("cta")}</button>
    </div>
  );
}
```

```tsx
// ❌ Non-compliant — blocked by eslint gate on migrated surfaces
export function MyNewComponent() {
  return <button>Save Changes</button>; // ESLint error
}
```

---

## Responsive Localization Test Matrix

A component is not localization-complete when its translations are correct. It is complete when it passes the full test matrix below.

### Supported Viewport Matrix

| Viewport | Width | Representative Device | Purpose |
|---|---|---|---|
| Small mobile | 375px | iPhone SE, budget Android | Smallest common size — worst case for text expansion |
| Standard mobile | 390px | iPhone 14 / Pixel 7 | Most common iOS size |
| Large mobile | 430px | iPhone 14 Plus / Pro Max | Large-phone baseline |
| Tablet portrait | 768px | iPad Mini / 8" Android | Shared-component tablet behavior |
| Desktop (secondary) | 1280px | Browser / web users | Layout regression only |

### Locale Test Suite per Component

| Test condition | Locale / Setting | What it catches |
|---|---|---|
| English baseline | `en` | Regression anchor |
| Pseudo-expanded text (+40%) | Synthetic pseudo-locale | Fixed-height containers, buttons that assume English length |
| Real long-text locale | `de` or `tl` | Actual translated word length breaking layouts |
| Arabic RTL | `ar` | Direction flip, icon mirroring, flex order, text alignment |
| Accessibility scaling | System text size XL | Long translated text + enlarged font = most damaging combination |

### Accessibility / Dynamic Text Scaling

Browser `font-size` and OS accessibility text scaling interact with translated text length. A component that passes at default size may fail at 125% or 150% text scaling.

Implementation: Playwright tests set `page.emulateMedia` with `--force-prefers-reduced-motion` and inject a CSS `font-size` multiplier at the root. Run at 100% and 130%.

### Failure Criteria

A component **fails** the matrix if at any viewport + locale combination:
- Any user-facing string is clipped (`overflow: hidden` cutting off text)
- Any interactive control is inaccessible (button too small, hidden, or overlapped)
- Navigation labels overflow their container without graceful wrapping or truncation
- Text becomes unreadable (below 12px effective size due to container shrinkage)
- RTL layout has LTR directional artifacts (wrong icon orientation, reversed padding)

### Pseudo-localization Generator

```ts
// scripts/pseudo-locale-gen.ts — generates xq.json for test suite
function pseudoLocalize(str: string): string {
  const expanded = str.replace(/[aeiou]/gi, c =>
    ({ a:"áa",e:"éé",i:"íi",o:"ôo",u:"üu" }[c.toLowerCase()] ?? c)
  );
  return `[Ħ${expanded} — ÐÐÐ]`; // ~40% longer, visually distinct
}
```

Run as `npx tsx scripts/pseudo-locale-gen.ts` to emit `client/src/i18n/locales/xq.json` for use in Playwright tests.

---

## UNKNOWN_REVIEW Classification

The Step 1B scanner classified 201 files as ORPHAN_DEAD based on zero route registrations and zero static importers. This is strong evidence but not conclusive proof. Dynamic imports via string concatenation, config registry references, and Capacitor plugin hooks could reference a file without appearing as a static import.

**Reclassification rule:**

Files formerly labeled ORPHAN_DEAD are split into two groups:
- **ORPHAN_DEAD (high confidence):** In `legacy/`, have `RETIRED_` prefix, or have patterns that are clearly decommissioned (commented-out exports, explicit "deprecated" comments)
- **UNKNOWN_REVIEW:** All others. No route, no static importers, but no explicit decommission signal. Human review required before any deletion action.

**Nothing gets deleted as part of localization work.** ORPHAN_DEAD and UNKNOWN_REVIEW files are simply excluded from the migration workload. Cleanup is a separate project.

---

## Migration Sequencing (awaiting approval)

```
PHASE 0 — Foundation (no app changes)
  ├── Install eslint-plugin-i18next
  ├── Wire key parity check into CI
  ├── Generate pseudo-locale for test suite
  └── Install tailwindcss-rtl plugin

PHASE 1 — Shared components (highest ROI)
  ├── Migrate Batch A shared components
  ├── Each one: add useTranslation → extract strings → add to locale files
  └── Run pseudo-locale + RTL test for each component before merge

PHASE 2 — High-traffic pages (safe automation)
  ├── Batch B pages: SAFE_AUTOMATION strings only
  └── Script-assisted extraction with human review of output

PHASE 3 — Mixed pages (human review)
  ├── Batch C pages: REVIEW_REQUIRED strings need human judgment
  └── Interpolation, conditionals, context-sensitive phrases

PHASE 4 — Clinical strings (controlled path)
  ├── Batch D: clinical/safety copy
  └── Qualified translator + clinical review before merge

PHASE 5 — AI locale propagation (parallel track)
  ├── Phase 1: Audit and patch 30+ bypass routes individually
  └── Phase 2: Consolidate openaiSafe.ts as universal wrapper

PHASE 6 — Key parity completion
  └── Fill missing translations in 13 locales for all migrated keys
```

---

## Files Requiring No Changes

| Category | File count | Action |
|---|---|---|
| ORPHAN_DEAD | 201 | Exclude from migration. Separate cleanup project. |
| QUARANTINED/LEGACY | 6 | Already isolated. No action. |
| UNKNOWN_REVIEW | Reclassified from ORPHAN_DEAD | Human review only. Never delete during localization. |

---

## Summary of What Doesn't Exist Yet

| Capability | Exists | Needed |
|---|---|---|
| Tailwind RTL plugin | ❌ | Phase 0 |
| `client/src/lib/locale.ts` formatting util | ❌ | Phase 0 |
| Pseudo-locale generator | ❌ | Phase 0 |
| eslint-plugin-i18next | ❌ | Phase 0 |
| Per-namespace locale files | ❌ | Phase 1 onward |
| `DirectionalIcon` wrapper | ❌ | Phase 1 |
| Playwright RTL + expansion tests | ❌ | Phase 1 |
| AI language propagation (universal) | ❌ | Phase 5 |
| Clinical translation namespace | ❌ | Phase 4 |
| `withLocale()` in openaiSafe.ts | ❌ | Phase 5 |

---

*This document is the architecture proposal. No bulk migration has occurred. All findings are based on the read-only Step 1A/1B audit scripts.*
