export interface WhatsNewRelease {
  version: string;
  date: string;
  headline: string;
  bullets: string[];
}

export const WHATS_NEW_RELEASES: WhatsNewRelease[] = [
  {
    version: "2.6",
    date: "June 2025",
    headline: "Your Nutrition Life Plan — redesigned",
    bullets: [
      "Cleaner card: macros visible at a glance, no clutter",
      "Tap the arrow to see your full nutrition profile — diet, cuisine, goal, builder, and active protocols all in one place",
      "Macro labels now in green so they pop on dark backgrounds",
    ],
  },
];

export const CURRENT_VERSION = WHATS_NEW_RELEASES[0].version;
export const DISMISS_KEY = `mpm.dismiss.whatsNew.v${CURRENT_VERSION}`;
