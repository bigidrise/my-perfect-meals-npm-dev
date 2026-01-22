export interface ReleaseNote {
  version: string;
  date: string;
  bugFixes: string[];
  designUpdates: string[];
}

export const currentRelease: ReleaseNote = {
  version: "1.0.5",
  date: "January 2026",
  bugFixes: [
    "Fixed screen flashing issues",
    "Resolved meals appearing across different meal boards",
    "Fixed disappearing meal cards",
    "Fixed refresh button reliability",
    "Fixed update banner appearing behind iOS notch"
  ],
  designUpdates: [
    "Cleaned up Chef button styling",
    "Redesigned update notification — now matches app theme",
    "Update banner works on all platforms (iOS, Android, Web)"
  ]
};
