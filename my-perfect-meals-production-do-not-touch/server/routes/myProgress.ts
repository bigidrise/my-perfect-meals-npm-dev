import express from 'express';

const router = express.Router();

// Body Progress Overview
router.get('/body', (req, res) => {
  res.json({
    currentWeight: 198,
    goalWeight: 180,
    weightChange: -12,
    bodyFat: 18,
    waist: 32,
    poundsToGoal: 18,
    streak: 12,
    xpPoints: 1150,
    weightLossProgress: 65,
  });
});

// Nutrition Compliance
router.get('/nutrition-compliance', (req, res) => {
  res.json({
    proteinGoalDays: 6,
    lowSugarDays: 5,
    dietCompliance: 87,
  });
});

// Consistency & Habit Streaks
router.get('/streaks', (req, res) => {
  res.json({
    mealLogging: 11,
    hydration: 9,
    healthyHabits: 7,
  });
});

// Weekly Wellness Grade
router.get('/wellness-grade', (req, res) => {
  res.json({
    grade: "B+",
    summary: "Good hydration, missed two lunches",
  });
});

// Areas for Improvement
router.get('/improvement-areas', (req, res) => {
  res.json({
    areas: [
      {
        priority: "High",
        title: "Increase Fiber Intake",
        suggestion: "Add more vegetables and whole grains to your meals"
      },
      {
        priority: "Medium",
        title: "Daily Movement",
        suggestion: "Add 10 more minutes of daily movement"
      },
      {
        priority: "Low",
        title: "Weekend Snacking",
        suggestion: "Reduce processed snacks during weekends"
      }
    ],
  });
});

// Nutrition Garden Overview
router.get('/nutrition-garden', (req, res) => {
  res.json({
    treeEmoji: "🌳",
    level: 5,
    message: "Your consistency tree is growing strong! Watered 6 of 7 days this week.",
  });
});

// Mindset & Psychology
router.get('/mindset', (req, res) => {
  res.json({
    checkins: 3,
    positivity: 75,
    journalPrompts: 2,
  });
});

// Activity Metrics - New endpoint for biometrics
router.get('/activity-metrics', (req, res) => {
  res.json({
    stepsToday: 8250,
    avgDailySteps: 9100,
    restingHeartRate: 62,
    maxHeartRate: 148,
  });
});

// Sleep Metrics - Industry parity endpoint
router.get('/sleep', (req, res) => {
  res.json({
    sleepDuration: 7.5,
    sleepQuality: 85,
    bedtime: "10:30 PM",
    wakeTime: "6:00 AM",
    deepSleep: 2.1,
    remSleep: 1.8,
    lightSleep: 3.6,
    sleepScore: 82
  });
});

// Hydration Metrics - Industry parity endpoint  
router.get('/hydration', (req, res) => {
  res.json({
    dailyIntake: 72,
    goalOunces: 80,
    percentage: 90,
    cupsToday: 9,
    goalCups: 10,
    hydrationScore: 88
  });
});

// Active Minutes & Calories - Industry parity endpoint
router.get('/active-minutes', (req, res) => {
  res.json({
    activeMinutes: 45,
    goalMinutes: 60,
    caloriesBurned: 520,
    goalCalories: 600,
    zone1Minutes: 15,
    zone2Minutes: 20,
    zone3Minutes: 10,
    activityScore: 75
  });
});

// Blood Pressure - Industry parity endpoint
router.get('/blood-pressure', (req, res) => {
  res.json({
    systolic: 118,
    diastolic: 78,
    reading: "118/78",
    category: "Normal",
    lastReading: "2025-08-16T08:30:00Z",
    trend: "stable",
    riskLevel: "low"
  });
});

// Heart Rate Variability (HRV) - Industry parity endpoint
router.get('/hrv', (req, res) => {
  res.json({
    hrvScore: 42,
    yesterdayScore: 39,
    sevenDayAverage: 41,
    status: "balanced",
    recoveryIndex: 8.2,
    stressLevel: "low"
  });
});

// VO₂ Max - Industry parity endpoint
router.get('/vo2-max', (req, res) => {
  res.json({
    vo2Max: 48.5,
    fitnessAge: 25,
    category: "Good",
    lastAssessment: "2025-08-10T00:00:00Z",
    trend: "improving",
    percentile: 72
  });
});

export default router;