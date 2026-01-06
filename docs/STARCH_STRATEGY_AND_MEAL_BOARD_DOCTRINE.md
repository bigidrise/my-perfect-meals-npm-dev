# Starch Strategy and Meal Board Doctrine

## Purpose of This Document

This file records **intentional product decisions** made by the founder and architect to prevent regression, confusion, or accidental feature re-introduction.

These decisions are **not bugs**.
They are **deliberate coaching and architectural choices**.

---

## 1. Core Philosophy (Do Not Violate)

* My Perfect Meals is **behavior-first**, not calorie-first
* Users execute nutrition in **meals**, not grams
* Starchy carbs and fibrous carbs are **not behaviorally equal**
* Vegetables should feel **safe and abundant**
* Starchy carbs must be **intentional**
* Some nutrition strategies require **human judgment** and must not be automated

---

## 2. Starch Meal Strategy (GLOBAL RULE)

### What It Is

A **meal-based behavioral system** that converts daily starch grams into **starch meal slots**.

### Why It Exists

* People fail when forced to manage grams all day
* Coaches succeed by guiding *when* carbs are eaten
* This mirrors real coaching practice

---

## 3. Starch Meal Strategy Options

Defined wherever macros are defined.

### Option A — One Starch Meal (DEFAULT)

* Full daily starch allowance used in one meal
* Best for fat loss, appetite control, insulin sensitivity

### Option B — Flex Split

* Daily starch divided across two meals
* Useful for training days or larger schedules

**No other options exist** (no 3+, no scheduling).

---

## 4. Source of Truth Rules

### Regular Users

* Source: **Macro Calculator**
* Persistence: `localStorage`
* Strategy defined in calculator

### Trainer-Managed Users (ProCare)

* Source: **Trainer Dashboard**
* Persistence: `proStore`
* Trainer macros override calculator
* Trainer must define starch strategy explicitly

---

## 5. Where Starch Meal Strategy Applies

### INCLUDED (Meal Planning Boards Only)

* WeeklyMealBoard
* BeachBodyMealBoard
* DiabeticMenuBuilder
* GLP1MealBuilder
* AntiInflammatoryMenuBuilder
* PerformanceCompetitionBuilder (trainer override)
* GeneralNutritionBuilder (trainer override)

These boards plan **daily or weekly meals**.

---

### EXCLUDED (One-Off Decision Tools)

* Craving Creator
* Fridge Rescue
* Create With Chef
* Snack Creator
* Dessert Creator
* Restaurant Guide
* Any other single-meal generator

Reason:

* These are not daily planners
* Starch slots would cause confusion

---

## 6. Meal Board Behavior Rules

* Each day displays **starch meal slots** (1 or 2)
* Adding a starch meal consumes a slot
* Fiber-based meals do not consume slots
* Soft coaching nudges allowed
* No hard blocks

---

## 7. Meal Card Display Rules

Meal cards on meal boards show ONLY:

* Protein
* Total Carbs
* Fat

Plus a label:

* Starch Meal (orange)
* Fiber-Based Meal (green)

NOT shown:
* Calories
* Starch grams
* Fiber grams

---

## 8. Remaining Today / Save Day to Biometrics

Displays ONLY:

* Protein
* Total Carbs
* Fat

Reason:

* Starch behavior already enforced at planning time
* This surface is feedback, not coaching

---

## 9. Performance Dietary Directives (IMPORTANT)

### Current Status: INTENTIONALLY HIDDEN

Hidden features:

* Carb Cycling
* High Protein Focus
* Other performance toggles

### Reason

* True carb cycling is **response-based coaching**
* Requires reading energy, mood, weight response
* Cannot be safely automated
* Checkboxes without visible state are misleading

These may return **only** as:

* Visible protocol cards
* Coach-driven systems
* Educational tools (BeachBody only)

Until then: **Do not expose in UI.**

---

## 10. Non-Negotiable Rules for Future Development

* Do not reintroduce hidden directives without discussion
* Do not add new macro math to meal cards
* Do not automate response-based protocols
* Do not violate source-of-truth hierarchy
* Behavior > tracking > analytics

---

## 11. Why This File Exists

This document exists to:

* Preserve coaching integrity
* Prevent accidental regression
* Align AI, engineers, and future contributors
* Encode real-world coaching into the product

If a future change conflicts with this document, **pause and review first**.

---

### End of Doctrine
