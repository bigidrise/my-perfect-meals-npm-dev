// Server-side quiz answer keys for Platform Mastery certification.
// These are the authoritative correctIndex values for each lesson's 10 questions,
// extracted from client/src/data/platformMasteryLessons.ts at build time.
// When quiz questions are updated, this file MUST be updated in sync.

export const QUIZ_ANSWER_KEYS: Record<string, number[]> = {
  "lesson-01": [1, 2, 1, 3, 1, 2, 1, 2, 2, 2],
  "lesson-02": [1, 2, 1, 1, 1, 1, 1, 2, 1, 1],
  "lesson-03": [1, 1, 2, 2, 1, 2, 1, 2, 2, 1],
  "lesson-04": [1, 1, 1, 2, 1, 2, 1, 1, 2, 2],
  "lesson-05": [2, 1, 1, 2, 1, 2, 2, 1, 1, 1],
  "lesson-06": [1, 1, 2, 1, 1, 2, 2, 1, 3, 2],
};
