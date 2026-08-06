# Pediatric Engine Engineering Standards

**Version 1.0 — Frozen**

This document is the constitution for anyone who builds, modifies, reviews, or validates the My Perfect Beginning pediatric nutrition engine. It does not expire. It does not get overridden by a task description, a deadline, or a shortcut. If an implementation decision conflicts with these rules, the implementation changes — not the rules.

---

## The Ten Rules

### Rule 1 — AI never makes clinical decisions.
The AI generates language. It does not determine what is safe, what is appropriate, what texture class applies, or which protocols govern a child's meal. Those decisions are made by the registries and the resolver before the AI is ever called. The AI receives a fully reasoned `PediatricMealGenerationContext` and its only job is to write the recipe within those bounds.

### Rule 2 — Registries own knowledge.
Every fact the engine uses — safety rules, disease protocols, ingredient behavior, food acceptance, culinary constraints, developmental baselines — lives in a registry. Knowledge is never hardcoded in a route, a prompt, or a service function. If a fact needs to change, it changes in the registry. The rest of the engine picks it up automatically.

### Rule 3 — Resolver owns reasoning.
The `PediatricResolver` is the single entry point that assembles all registry knowledge into a `PediatricMealGenerationContext`. No other part of the system is allowed to reason about protocols, safety rules, or behavioral strategies. If a route needs to know "what protocols apply to Emma," it calls the resolver — it does not query registries directly.

### Rule 4 — AI owns language.
Once the resolver has produced a complete context, the AI's role is narrow: turn structured decisions into readable recipe text, a plain-English explanation, and a reasoning trace. The AI may not invent clinical facts, deviate from the context's constraints, or override any field in the context. Post-generation guardrails (`scanGeneratedOutput`) verify this.

### Rule 5 — Every rule has a permanent ID.
Every entry in every registry has a stable, typed, permanent identifier (e.g. `RULE-0014`, `COND-0008`, `ING-000124`, `BEH-0022`, `CUL-0017`). IDs are never reassigned. IDs are never reused after retirement. The reasoning trace and rule fire log reference IDs, not descriptions. A description can be rewritten; an ID cannot.

### Rule 6 — Every registry entry is versioned.
Every protocol, every rule, and every evidence record carries: version, effective date, review date, reviewer, and status (`approved` / `pending_review` / `deprecated`). When a review date passes without re-review, the entry automatically downgrades to `pending_review`. Deprecated entries are never deleted — they are archived with a deprecation date and reason.

### Rule 7 — Every recommendation must be traceable.
The output of every meal generation includes a Registry Trace: the permanent IDs of every rule, protocol, ingredient, behavioral strategy, and culinary constraint that participated in producing the context. A clinician, a QA reviewer, or a regulatory auditor must be able to reconstruct exactly why the engine made every decision from the trace alone.

### Rule 8 — Safety outranks personalization.
The priority hierarchy is fixed and non-negotiable:
1. Life-threatening safety (allergens, PKU, G-tube, early infant block)
2. Developmental stage hard stops
3. Medical condition hard limits
4. Growth context
5. Sensory and feeding development
6. Medical optimization
7. Family goals and preferences
8. Kitchen reality

A personalization preference never overrides a safety rule. A family override never overrides a medical hard limit. The hierarchy is enforced by the resolver and verified by `enforceBeforeGenerate()`.

### Rule 9 — Clinical correctness outranks creativity.
When the resolver has constrained the ingredient pool, the texture class, and the behavioral strategy, the AI works within those constraints. It does not find creative workarounds. It does not substitute ingredients the resolver excluded. It does not soften a hard limit because a "better" recipe might result. Clinical correctness is the floor. Creativity operates above it.

### Rule 10 — Never bypass the resolver.
No route, no service, no shortcut calls the AI with a pediatric request without first calling the resolver. No prompt is assembled from raw user input. No clinical decision is made inline in a route handler. The resolver is the only authorized path from child profile to generation context. Bypassing it — even temporarily, even for a demo — is not allowed.

---

## The Resolver Inspector Is Not Optional

The Resolver Inspector is a required acceptance criterion for the Pediatric Resolver (Task #428). The resolver is not complete until the inspector can display — without making any AI call — the full reasoning breakdown for any child profile:

- Development Stage (derived from DOB)
- Clinical Rules Fired (with permanent IDs)
- Disease Protocols Active (with permanent IDs)
- Ingredient Candidates (from Ingredient Intelligence Registry)
- Excluded Ingredients (with reason and rule ID)
- Behavior Strategy (from Food Acceptance Profile + Behavioral Registry)
- Kitchen Reality constraints
- Culinary Strategy (meal type, texture class, school rules)
- Conflict Resolutions (which protocol won, why, what was substituted)
- Confidence scores (Meal, Clinical, Personalization)
- Registry Trace (all permanent IDs that participated)
- Final `PediatricMealGenerationContext` (raw JSON)

If the inspector cannot display all of the above, the resolver review fails regardless of what the code looks like.

---

## What Must Happen Before AI Generates Any Recipe

In order:

1. Child Profile verified complete (Task #422 ✅ merged)
2. Pediatric Rule Registry built and populated (Task #426 ✅ merged)
3. Food Behavior Registry built and populated (Task #426 ✅ merged)
4. Disease Protocol Registry built and populated (Task #425 — merging)
5. Parent Education Layer built (Task #427 ✅ merged)
6. Pediatric Resolver built and Resolver Inspector passing (Task #428 — in progress)
7. Registry IDs and Health Dashboard (Task #429 — in progress)
8. 100 clinical test scenarios passing (Task #430 — in progress)
9. Create a Dish adapted to consume `PediatricMealGenerationContext`
10. **Only then** does the AI generate recipes

Steps 9 and 10 do not begin until steps 1–8 are verified.

---

## What the Pediatric Engine Is Not

- It is not the adult engine with smaller portions.
- It is not a recipe website with safety warnings added.
- It is not a chatbot that answers nutrition questions.
- It is not a replacement for a pediatrician or registered dietitian.

---

## What the Pediatric Engine Is

A pediatric nutrition decision engine that helps parents consistently make safer, healthier, age-appropriate food decisions for their children while respecting pediatric medical guidance. Every recipe is simply the output of that decision engine.

The engine's priorities, in order:
1. Safety
2. Clinical nutrition
3. Personalization
4. Behavior change
5. Recipe generation

The recipe is number five. That is where it belongs.

---

## Clinician Review Readiness Criteria

The engine is ready for pediatric clinician review when:

- All registries are populated with evidence-backed entries
- Every entry has a permanent ID and a review status
- The Resolver Inspector is functional and displays a complete trace
- 100 clinical test scenarios pass at: 100% hard-stop accuracy, ≥95% soft-scenario accuracy
- The mandatory pediatrician disclaimer appears on every generated output
- No AI call is made without a complete `PediatricMealGenerationContext`

The engine is **not** ready for clinician review before these criteria are met. Clinicians should review clinical logic, not prompts.

---

*This document was established during the My Perfect Beginning architecture phase. It does not change unless a formal engineering review determines a rule needs revision, at which point the change is versioned and the previous rule is archived — not deleted.*
