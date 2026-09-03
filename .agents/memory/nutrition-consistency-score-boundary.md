---
name: Nutrition consistency score boundary
description: Product rules for the first marketable Nutrition Life Plan consistency/adherence score.
---

The score must measure observable behaviors the user controls: meal consistency, macro adherence, and hydration adherence when an authoritative target exists. Protocol adherence is excluded because MPM applies protocol rules automatically. Calories should not remain a standalone component when macro adherence already captures the meaningful nutrition behavior. Nutrition Life Plan engagement remains visible outside the score until a stable event contract exists.

Meal consistency combines two distinct observable signals: completion of planned meal slots and days with explicit nutrition logs. Replacement chains represent one meal decision and must collapse to one planned slot; missing macro targets make macro adherence unavailable, not failed.

For Hydration, TRACK_ONLY or missing-target states must not receive an invented ounces target, progress percentage, or physiological adherence score. A Hydration adherence component is valid only when a current authoritative numeric requirement exists.

**Why:** Scoring platform-enforced rules gives or removes credit for behavior the user did not choose, while scoring targetless Hydration disguises app engagement as physiological adherence.

**How to apply:** Preserve these boundaries when changing the consumer score, professional score views, Nutrition Activity Summary, Hydration cards, or historical score persistence.