---
name: Affiliate Certification — Quiz Persistence
description: How quiz progress auto-save and resume works for the affiliate certification system
---

## Table

`certification_quiz_attempts` — one row per (userId, certificationType, moduleId); UNIQUE constraint enforces single active attempt.

Columns: id, user_id, certification_type, module_id, status (in_progress), answers_json (jsonb), score, started_at, completed_at.

## JSONB merge upsert pattern

When saving a single answer, use INSERT ... ON CONFLICT DO UPDATE with JSONB merge:

```typescript
await db.insert(certificationQuizAttempts).values({ ... answersJson: { [questionId]: answerIndex } })
  .onConflictDoUpdate({
    target: [userId, certificationType, moduleId],
    set: {
      answersJson: sql`COALESCE(${certificationQuizAttempts.answersJson}, '{}') || ${answerPatch}::jsonb`,
    },
  });
```

Where `answerPatch = JSON.stringify({ [questionId]: answerIndex })`.

## API endpoints (all under /api/certifications)

- `GET /:certType/modules/:moduleId/quiz-attempt` — fetch in_progress attempt (returns attempt or null)
- `POST /:certType/modules/:moduleId/quiz-attempt/answer` — upsert with merged answer (fire-and-forget from client)
- `DELETE /:certType/modules/:moduleId/quiz-attempt` — clear attempt (called on submit + retry)

## Frontend (CertificationQuiz.tsx)

- Phase: `loading → quiz → results`
- On mount: fetch attempt → restore answers → set phase to "quiz"
- On answer click: `setAnswers(...)` + `saveAnswer(...)` (fire-and-forget, no loading state)
- On submit: POST /quiz for score recording → DELETE attempt → setPhase("results")
- On retry: DELETE attempt → reset answers → setPhase("quiz")
- Shows resume banner when answers > 0 and < total
- Submit button text shows remaining count: "3 questions remaining"

## Final assessment flow

**Why changed:** Final assessment previously called `POST /:certType/complete` directly from the quiz page, bypassing the name modal on the dashboard.

**Correct flow:** After passing final assessment, quiz routes to `/certification` (dashboard). Dashboard detects allDone=true, shows "Complete Certification" → name modal → calls /complete with name → routes to /complete page.

This keeps certificate name capture consistent and avoids certs being issued without a name.
