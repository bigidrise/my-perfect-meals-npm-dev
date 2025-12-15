import type { WalkthroughScript } from "../WalkthroughTypes";

const BiometricsWalkthroughScript: WalkthroughScript = {
  id: "biometrics-walkthrough",
  featureId: "MY_BIOMETRICS",
  title: "My Biometrics",
  uiReady: true,
  steps: [
    {
      id: "intro",
      targetTestId: "biometrics-macro-summary",
      description: "Welcome to My Biometrics! This is your nutrition and body tracking hub. See today's macro totals at the top.",
      message: "Welcome to My Biometrics! Track your nutrition and body stats here.",
      speak: "Welcome to Biometrics. Track your nutrition here.",
      spotlight: true,
    },
    {
      id: "macro-inputs",
      targetTestId: "biometrics-macro-inputs",
      description: "Add nutrition by entering protein, carbs, fat, and calories manually. Or use the camera button to scan your meal.",
      message: "Add macros manually here, or use the camera to scan meals.",
      speak: "Add macros manually or scan meals.",
      spotlight: true,
    },
    {
      id: "add-macros",
      targetTestId: "biometrics-add-button",
      description: "Tap 'Add' to log these macros to today's total. They'll update your progress bars instantly.",
      message: "Tap 'Add' to log macros to today's total.",
      speak: "Tap Add to log your macros.",
      spotlight: true,
      waitForEvent: { testId: "biometrics-macros-added", event: "done" },
    },
    {
      id: "macro-progress",
      targetTestId: "biometrics-progress-bars",
      description: "Your progress bars show how close you are to your daily macro targets.",
      message: "Progress bars show your daily macro targets.",
      speak: "View your macro progress here.",
      spotlight: true,
    },
    {
      id: "weight-tracking",
      targetTestId: "biometrics-weight-input",
      description: "Track your body weight here. Enter your current weight to log it over time.",
      message: "Enter your weight to track your progress over time.",
      speak: "Track your weight here.",
      spotlight: true,
    },
    {
      id: "save-weight",
      targetTestId: "biometrics-save-weight-button",
      description: "Tap 'Save Weight' to add this entry to your weight history chart.",
      message: "Tap 'Save Weight' to log this to your history.",
      speak: "Save your weight to track progress.",
      spotlight: true,
      waitForEvent: { testId: "biometrics-weight-saved", event: "done" },
    },
    {
      id: "charts",
      targetTestId: "biometrics-charts-section",
      description: "View your calorie and weight trends over time in these charts.",
      message: "Charts show your nutrition and weight trends.",
      speak: "View your progress charts.",
      spotlight: true,
    },
    {
      id: "complete",
      targetTestId: "biometrics-macro-summary",
      description: "Perfect! You now know how to track your nutrition and body stats. Keep logging daily to see your progress!",
      message: "You're all set! Keep tracking daily to reach your goals.",
      speak: "You're ready to track your progress.",
      spotlight: false,
    },
  ],
};

export default BiometricsWalkthroughScript;
