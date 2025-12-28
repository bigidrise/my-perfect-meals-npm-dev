// client/src/utils/features.ts
export const FEATURES = {
  explainMode: 'alpha',      // 'alpha' | 'off'
  weeklyGenerator: 'alpha',
  templateLibrary: 'off',   // Template Hub OFF
  cafeteria: 'off',         // Cafeteria OFF
  dayPlanning: 'alpha',
  shoppingList: 'alpha',
  showCreateWithAI: false,  // Hide "Create with AI" for launch - only show "Create with Chef"
} as const;

// Tiny helper if you want to swap modes later:
// export const isEnabled = (flag: keyof typeof FEATURES) => FEATURES[flag] !== 'off';