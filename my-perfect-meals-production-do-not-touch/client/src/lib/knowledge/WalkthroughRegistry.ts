export interface WalkthroughStep {
  id: string;
  text: string;
  targetId?: string; // unique ID for UI highlight
  waitForUser?: boolean;
}

export const WalkthroughRegistry: Record<string, WalkthroughStep[]> = {
  // ==============================
  // 🔥 FRIDGE RESCUE WALKTHROUGH
  // ==============================
  "fridge-rescue": [
    {
      id: "step-1",
      text: "Tap the + button to add items from your fridge.",
      targetId: "fridge-add-button",
      waitForUser: true,
    },
    {
      id: "step-2",
      text: "Enter your ingredients and then tap Save.",
      waitForUser: true,
    },
    {
      id: "step-3",
      text: "Great! Now choose your servings.",
      targetId: "fridge-servings-selector",
      waitForUser: true,
    },
    {
      id: "step-4",
      text: "Now tap Create Meal to get instant options.",
      targetId: "fridge-create-meal-button",
      waitForUser: true,
    },
    {
      id: "complete",
      text: "You're done! Let me know if you want quick meal ideas too.",
    },
  ],

  // ==============================
  // 🔥 WEEKLY BOARD WALKTHROUGH
  // ==============================
  "weekly-board": [
    {
      id: "step-1",
      text: "Tap any empty slot to add a meal.",
      targetId: "weekly-empty-slot",
      waitForUser: true,
    },
    {
      id: "step-2",
      text: "Choose a meal manually or ask AI to help.",
      waitForUser: true,
    },
    {
      id: "step-3",
      text: "Drag and drop meals to organize your week.",
      waitForUser: false,
    },
    {
      id: "complete",
      text: "Your weekly plan is ready!",
    },
  ],

  // ==============================
  // 🔥 WEEKLY MEAL BUILDER (Phase C.1)
  // ==============================
  "weekly-meal-builder": [
    {
      id: "step-1",
      text: "Tap any empty slot to add a meal.",
      targetId: "weekly-empty-slot",
      waitForUser: true,
    },
    {
      id: "step-2",
      text: "Choose meals and drag them to organize your week.",
      waitForUser: false,
    },
    {
      id: "complete",
      text: "Your weekly plan is ready! Ask me anytime for help.",
    },
  ],

  // ==============================
  // 🔥 MASTER SHOPPING LIST WALKTHROUGH
  // ==============================
  "shopping-master": [
    { id: "step-1", text: "Scan a barcode to instantly add packaged items.", targetId: "msl-barcode-button", waitForUser: false },
    { id: "step-2", text: "Use voice input to quickly add items without typing.", targetId: "msl-voice-add-button", waitForUser: false },
    { id: "step-3", text: "Use Bulk Add to enter multiple items at once.", targetId: "msl-bulk-add-button", waitForUser: false },
    { id: "step-4", text: "All items — from AI meals and your entries — show up here.", targetId: "msl-items-list", waitForUser: false },
    { id: "step-5", text: "Tap a card to see details or modify the item.", targetId: "msl-item-card", waitForUser: false },
    { id: "step-6", text: "Tap here to mark the item as purchased — it moves to the bottom.", targetId: "msl-item-checkoff", waitForUser: false },
    { id: "step-7", text: "Use this to delete an item you no longer need.", targetId: "msl-item-trash", waitForUser: false },
    { id: "complete", text: "You're all set with the Master Shopping List!" },
  ],

  // ==============================
  // 🔥 BIOMETRICS WALKTHROUGH
  // ==============================
  "biometrics": [
    { id: "step-1", text: "Tap here to log macros by taking a photo of a nutrition label.", targetId: "bio-scan-button", waitForUser: false },
    { id: "step-2", text: "Enter your own protein amount here if logging manually.", targetId: "bio-manual-protein", waitForUser: false },
    { id: "step-3", text: "Enter carbs manually here.", targetId: "bio-manual-carbs", waitForUser: false },
    { id: "step-4", text: "Enter fats here.", targetId: "bio-manual-fat", waitForUser: false },
    { id: "step-5", text: "Or enter calories directly if that's all you know.", targetId: "bio-manual-calories", waitForUser: false },
    { id: "step-6", text: "Tap Add to add your manual entry to today's macros.", targetId: "bio-manual-add-button", waitForUser: false },
    { id: "step-7", text: "If you're short on protein or carbs at the end of the day, use Additional Macros to top off. For example, if you need more protein, you can add a protein shake.", targetId: "bio-additional-macros-note", waitForUser: false },
    { id: "step-8", text: "Pick the food source you're adding — like Whey for a protein shake, Chicken, Turkey, Fish, Rice, or Oats. This ensures the right macro tails get applied.", targetId: "bio-food-source-dropdown", waitForUser: false },
    { id: "step-9", text: "Once you've selected your source, tap Add to apply those macros to your daily total.", targetId: "bio-additional-add-button", waitForUser: false },
    { id: "step-10", text: "Your totals update automatically using your Macro Calculator targets.", targetId: "bio-macro-total-display", waitForUser: false },
    { id: "step-11", text: "Your total calories consumed today appears here.", targetId: "bio-calories-today", waitForUser: false },
    { id: "step-12", text: "This graph shows your calorie trends over time.", targetId: "bio-graph", waitForUser: false },
    { id: "step-13", text: "Enter your current weight here.", targetId: "bio-weight-input", waitForUser: false },
    { id: "step-14", text: "Tap Save to log your weight into your history.", targetId: "bio-weight-save-button", waitForUser: false },
    { id: "step-15", text: "Track how much water you've had today.", targetId: "bio-water-counter", waitForUser: false },
    { id: "step-16", text: "Tap to add 8 ounces.", targetId: "bio-water-plus8", waitForUser: false },
    { id: "step-17", text: "Tap to add 16 ounces.", targetId: "bio-water-plus16", waitForUser: false },
    { id: "complete", text: "You now know how to track everything in Biometrics!" },
  ],

  // ==============================
  // 🔥 MACRO CALCULATOR WALKTHROUGH
  // ==============================
  "macro-calculator": [
    { id: "step-1", text: "Choose whether you're cutting, maintaining, or gaining.", targetId: "mc-goal-selector", waitForUser: false },
    { id: "step-2", text: "Select your body type: Ectomorph, Mesomorph, or Endomorph.", targetId: "mc-body-type-cards", waitForUser: false },
    { id: "step-3", text: "Choose US Standard or Metric for your measurements.", targetId: "mc-units-toggle", waitForUser: false },
    { id: "step-4", text: "Select your biological sex for accurate calculations.", targetId: "mc-sex-selector", waitForUser: false },
    { id: "step-5", text: "Enter your age.", targetId: "mc-age-input", waitForUser: false },
    { id: "step-6", text: "Enter your height (feet).", targetId: "mc-height-ft", waitForUser: false },
    { id: "step-7", text: "Enter inches here.", targetId: "mc-height-in", waitForUser: false },
    { id: "step-8", text: "Enter your current weight.", targetId: "mc-weight-input", waitForUser: false },
    { id: "step-9", text: "Pick your weekly activity level — this affects your calorie needs.", targetId: "mc-activity-selector", waitForUser: false },
    { id: "step-10", text: "Tap to sync your latest weight from the Biometrics page.", targetId: "mc-sync-weight", waitForUser: false },
    { id: "step-11", text: "Here are your calculated daily macro targets.", targetId: "mc-targets-display", waitForUser: false },
    { id: "step-12", text: "Tap here to save your targets to the Biometrics page.", targetId: "mc-set-targets-button", waitForUser: false },
    { id: "complete", text: "Perfect! You're now ready to track your macros accurately." },
  ],

  // ==============================
  // 🔥 GET INSPIRATION WALKTHROUGH
  // ==============================
  "get-inspiration": [
    { id: "step-1", text: "Tap here to refresh your inspiration quote.", targetId: "insp-get-button", waitForUser: false },
    { id: "step-2", text: "Your motivational quote will appear here.", targetId: "insp-quote-display", waitForUser: false },
    { id: "complete", text: "That's all! Tap anytime you need motivation." },
  ],

  // ==============================
  // 🔥 DAILY HEALTH JOURNAL WALKTHROUGH
  // ==============================
  "daily-journal": [
    { id: "step-1", text: "Tap here to speak your journal entry using your voice.", targetId: "journal-voice-input", waitForUser: false },
    { id: "step-2", text: "Your spoken or typed thoughts will appear here.", targetId: "journal-textarea", waitForUser: false },
    { id: "step-3", text: "Tap Save Entry to record today's thoughts.", targetId: "journal-save-button", waitForUser: false },
    { id: "step-4", text: "Your saved entries show up here for future review.", targetId: "journal-entry-list", waitForUser: false },
    { id: "complete", text: "You're ready to journal! Keep tracking your thoughts." },
  ],

  // ==============================
  // 🔥 PROACCESS CARE TEAM WALKTHROUGH
  // ==============================
  "proaccess-careteam": [
    { id: "step-1", text: "Start by inviting your client by email.", targetId: "pro-invite-email", waitForUser: false },
    { id: "step-2", text: "Choose your role — trainer or physician.", targetId: "pro-role-selector", waitForUser: false },
    { id: "step-3", text: "Tap to send the invitation with the access code.", targetId: "pro-send-invite-button", waitForUser: false },
    { id: "step-4", text: "If you have a code from a client, put it here.", targetId: "pro-access-code-input", waitForUser: false },
    { id: "step-5", text: "Tap to link the client to your Care Team.", targetId: "pro-link-code-button", waitForUser: false },
    { id: "step-6", text: "Your linked clients appear here.", targetId: "pro-active-team-list", waitForUser: false },
    { id: "step-7", text: "Tap a client to manage them.", targetId: "pro-careteam-member", waitForUser: false },
    { id: "step-8", text: "Tap to open the ProPortal dashboard.", targetId: "pro-open-proportal-button", waitForUser: false },
    { id: "step-9", text: "Enter the client's name here.", targetId: "pro-client-name-input", waitForUser: false },
    { id: "step-10", text: "Optional: enter their email for communication.", targetId: "pro-client-email-input", waitForUser: false },
    { id: "step-11", text: "Tap to create a new client card.", targetId: "pro-add-client-button", waitForUser: false },
    { id: "step-12", text: "Here's your client. Tap Open to manage them.", targetId: "pro-client-card", waitForUser: false },
    { id: "step-13", text: "Tap Open to go to their dashboard.", targetId: "pro-client-open-button", waitForUser: false },
    { id: "step-14", text: "Enter the daily protein target here.", targetId: "pro-macro-protein", waitForUser: false },
    { id: "step-15", text: "Set daily starchy carbs.", targetId: "pro-macro-starchy", waitForUser: false },
    { id: "step-16", text: "Set daily fibrous carbs.", targetId: "pro-macro-fibrous", waitForUser: false },
    { id: "step-17", text: "Enter recommended fats per day.", targetId: "pro-macro-fat", waitForUser: false },
    { id: "step-18", text: "Tap to save all macro targets.", targetId: "pro-macro-save", waitForUser: false },
    { id: "step-19", text: "Enable high-protein protocol if needed.", targetId: "pro-high-protein-toggle", waitForUser: false },
    { id: "step-20", text: "Enable carb cycling protocol.", targetId: "pro-carb-cycle-toggle", waitForUser: false },
    { id: "step-21", text: "Enable anti-inflammatory protocol.", targetId: "pro-anti-inflammatory-toggle", waitForUser: false },
    { id: "step-22", text: "Tap here to send macro targets to Biometrics.", targetId: "pro-send-to-biometrics-button", waitForUser: false },
    { id: "step-23", text: "Set custom daily starchy carb directives.", targetId: "pro-carb-directive-starchy", waitForUser: false },
    { id: "step-24", text: "Set custom daily fibrous directives.", targetId: "pro-carb-directive-fibrous", waitForUser: false },
    { id: "step-25", text: "Save carbohydrate directives here.", targetId: "pro-directive-save", waitForUser: false },
    { id: "step-26", text: "Physician-specific builder: Diabetic.", targetId: "pro-physician-diabetes", waitForUser: false },
    { id: "step-27", text: "Physician-specific builder: GLP-1.", targetId: "pro-physician-glp1", waitForUser: false },
    { id: "step-28", text: "Physician-specific builder: Anti-inflammatory.", targetId: "pro-physician-antiinflammatory", waitForUser: false },
    { id: "step-29", text: "Trainer-specific builder: Performance & Competitive.", targetId: "pro-trainer-performance", waitForUser: false },
    { id: "step-30", text: "Trainer-specific builder: General Nutrition.", targetId: "pro-trainer-general", waitForUser: false },
    { id: "complete", text: "You're all set with ProAccess Care Team!" },
  ],

  // ==============================
  // 🔥 DIABETIC HUB WALKTHROUGH
  // ==============================
  "diabetic-hub": [
    { id: "step-1", text: "Choose a clinical preset like Strict Control or Cardiac Diet.", targetId: "dia-preset-selector", waitForUser: false },
    { id: "step-2", text: "Set your fasting glucose range exactly as your doctor recommends.", targetId: "dia-fasting-range-input", waitForUser: false },
    { id: "step-3", text: "Set your post-meal glucose range.", targetId: "dia-postmeal-range-input", waitForUser: false },
    { id: "step-4", text: "Enter your daily carbohydrate limit.", targetId: "dia-carb-limit-input", waitForUser: false },
    { id: "step-5", text: "Set your minimum daily fiber goal.", targetId: "dia-fiber-min-input", waitForUser: false },
    { id: "step-6", text: "Set a glycemic index cap for safe meal creation.", targetId: "dia-gi-cap-input", waitForUser: false },
    { id: "step-7", text: "Tap to save all clinical guardrails.", targetId: "dia-save-guardrails-button", waitForUser: false },
    { id: "step-8", text: "Enter your blood sugar reading here.", targetId: "dia-bg-input", waitForUser: false },
    { id: "step-9", text: "Choose fasting, pre-meal, or post-meal.", targetId: "dia-bg-type-selector", waitForUser: false },
    { id: "step-10", text: "Tap to log your blood sugar.", targetId: "dia-bg-log-button", waitForUser: false },
    { id: "step-11", text: "View your 7-day glucose trend here.", targetId: "dia-bg-trend-graph", waitForUser: false },
    { id: "step-12", text: "Tap to open the Diabetic Menu Builder for blood-sugar-safe meals.", targetId: "dia-open-menu-builder-button", waitForUser: false },
    { id: "complete", text: "You're ready to manage diabetes with guardrails!" },
  ],

  // ==============================
  // 🔥 GLP-1 HUB WALKTHROUGH
  // ==============================
  "glp1-hub": [
    { id: "step-1", text: "Tap Open Tracker to begin logging your dose.", targetId: "glp1-open-tracker-button", waitForUser: false },
    { id: "step-2", text: "Enter the dose you injected today.", targetId: "glp1-dose-input", waitForUser: false },
    { id: "step-3", text: "Confirm or adjust the date of your injection.", targetId: "glp1-date-field", waitForUser: false },
    { id: "step-4", text: "Confirm or adjust the injection time.", targetId: "glp1-time-field", waitForUser: false },
    { id: "step-5", text: "Select where you injected: abdomen, thigh, upper arm, or buttock.", targetId: "glp1-site-selector", waitForUser: false },
    { id: "step-6", text: "Tap here to save your dose to your history.", targetId: "glp1-save-dose-button", waitForUser: false },
    { id: "step-7", text: "Your past injection records appear here.", targetId: "glp1-dose-history-list", waitForUser: false },
    { id: "step-8", text: "Choose a GLP-1 preset based on your doctor's instructions.", targetId: "glp1-preset-selector", waitForUser: false },
    { id: "step-9", text: "Set your maximum meal volume to avoid discomfort.", targetId: "glp1-max-volume-input", waitForUser: false },
    { id: "step-10", text: "Set your daily minimum protein target.", targetId: "glp1-protein-min-input", waitForUser: false },
    { id: "step-11", text: "Set your maximum fat intake per day.", targetId: "glp1-fat-max-input", waitForUser: false },
    { id: "step-12", text: "Set your minimum fiber intake per day.", targetId: "glp1-fiber-min-input", waitForUser: false },
    { id: "step-13", text: "Set your hydration goal for the day.", targetId: "glp1-hydration-goal-input", waitForUser: false },
    { id: "step-14", text: "Enter how many meals per day you're having on GLP-1.", targetId: "glp1-meals-per-day-input", waitForUser: false },
    { id: "step-15", text: "Tap here to activate all GLP-1 clinical guardrails.", targetId: "glp1-save-guardrails-button", waitForUser: false },
    { id: "step-16", text: "Next, tap here to generate GLP-1-safe meals.", targetId: "glp1-open-menu-builder-button", waitForUser: false },
    { id: "complete", text: "Perfect! You're ready to use GLP-1 Hub." },
  ],
};
