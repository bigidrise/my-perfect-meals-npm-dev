import fs from "fs";
import path from "path";
import { db } from "../db";
import { triviaQuestions } from "../db/schema/trivia";

async function run() {
  const items = [
    {
      category: "Habits",
      mindsetCategory: "Habits",
      psychProfileTags: ["low_consistency","needs_habit_help"],
      question: "What's the most reliable way to make a new habit stick?",
      choices: ["Rely on motivation", "Do it randomly", "Stack it onto an existing daily cue", "Wait until you feel ready"],
      answerIndex: 2,
      difficulty: 1,
      explanation: "Habit stacking ties a new action to a stable cue (e.g., after coffee, do 10 squats)."
    },
    {
      category: "Mindfulness",
      mindsetCategory: "Mindfulness", 
      psychProfileTags: ["stress_mgmt","needs_resilience_boost"],
      question: "Why does slow nasal breathing reduce stress quickly?",
      choices: ["Increases adrenaline", "Activates the parasympathetic response", "Builds more muscle", "Raises blood sugar"],
      answerIndex: 1,
      difficulty: 1,
      explanation: "Slow exhale bias activates the vagus nerve and downshifts arousal."
    },
    {
      category: "Focus",
      mindsetCategory: "Focus",
      psychProfileTags: ["focus_training","reduce_distractions"],
      question: "Best first step to improve focus during work?",
      choices: ["Keep notifications on", "Batch distractions into set breaks", "Multitask more", "Drink more caffeine late"],
      answerIndex: 1,
      difficulty: 1,
      explanation: "Batching distractions protects deep work blocks; check phone on scheduled breaks."
    },
    {
      category: "Nutrition",
      mindsetCategory: "Nutrition",
      psychProfileTags: [],
      question: "Which pairing best supports recovery post-workout?",
      choices: ["Carbs + Protein", "Fat + Fat", "Fiber + Water only", "Alcohol + Protein"],
      answerIndex: 0,
      difficulty: 1,
      explanation: "Carbs replenish glycogen; protein supports muscle repair."
    },
    {
      category: "Fitness",
      mindsetCategory: "Resilience",
      psychProfileTags: ["build_internal_drive"],
      question: "Progressive overload mainly means…",
      choices: ["Random new moves", "Increasing training stress over time", "Longer selfies", "Same weight forever"],
      answerIndex: 1,
      difficulty: 1,
      explanation: "Increase load/volume/density gradually to keep adapting."
    },
    {
      category: "Resilience",
      mindsetCategory: "Resilience",
      psychProfileTags: ["anti_procrastination"],
      question: "A proven way to beat procrastination is…",
      choices: ["Wait for perfect timing", "Make the first step tiny and immediate", "Add more tasks", "Punish yourself harshly"],
      answerIndex: 1,
      difficulty: 1,
      explanation: "Make tasks smaller than resistance; start now to gain momentum."
    }
  ];
  
  await db.insert(triviaQuestions).values(items).onConflictDoNothing();
  console.log("Seeded questions:", items.length);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });