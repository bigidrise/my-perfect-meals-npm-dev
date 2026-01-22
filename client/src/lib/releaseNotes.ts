export interface ReleaseNote {
  version: string;
  date: string;
  bugFixes: string[];
  designUpdates: string[];
}

export const currentRelease: ReleaseNote = {
  version: "1.0.6",
  date: "January 2026",
  bugFixes: [
    "Fixed screen flashing issues",
    "Resolved meals appearing across different meal boards",
    "Fixed disappearing meal cards",
    "Fixed update banner refresh button not responding",
    "Fixed update banner appearing behind iOS notch",
    "Fixed password eyeball toggle — now press-and-hold on all devices"
  ],
  designUpdates: [
    "Cleaned up Chef button — removed orange glow",
    "Redesigned update notification — black/orange theme",
    "Update banner works on all platforms (iOS, Android, Web)",
    "Added 'What's New' button to see changes before updating"
  ]
};
