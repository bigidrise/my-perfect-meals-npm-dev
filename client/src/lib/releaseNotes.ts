export interface ReleaseNote {
  version: string;
  date: string;
  bugFixes: string[];
  designUpdates: string[];
}

export const currentRelease: ReleaseNote = {
  version: "1.0.9",
  date: "January 2026",
  bugFixes: [
    "Fixed screen flashing issues",
    "Resolved meals appearing across different meal boards",
    "Fixed disappearing meal cards",
    "Fixed password toggle jumping on mobile"
  ],
  designUpdates: [
    "Cleaned up Chef button — removed orange glow",
    "New 'What's New' update banner with release notes",
    "Premium branded voice experience — consistent Chef voice throughout"
  ]
};
