export interface CoachConfig {
  slug: string;
  displayName: string;
  title: string;
  isFounder: boolean;
  userIdEnv: string;
  studioIdEnv: string;
  image?: string;
  bio?: string;
}

export const coaches: Record<string, CoachConfig> = {
  idrise: {
    slug: "idrise",
    displayName: "Coach Idrise",
    title: "Founder & Head Coach",
    isFounder: true,
    userIdEnv: "COACH_IDRISE_USER_ID",
    studioIdEnv: "COACH_IDRISE_STUDIO_ID",
    image: "/assets/founder-photo.jpg",
    bio: "Founder of My Perfect Meals. Direct async coaching for structured nutrition.",
  },
  // To add a new coach:
  // jen: {
  //   slug: "jen",
  //   displayName: "Coach Jen",
  //   title: "Nutrition Coach",
  //   isFounder: false,
  //   userIdEnv: "COACH_JEN_USER_ID",
  //   studioIdEnv: "COACH_JEN_STUDIO_ID",
  //   image: "/assets/coach-jen.jpg",
  //   bio: "...",
  // },
};

export function getCoach(slug: string): CoachConfig | null {
  return coaches[slug] ?? null;
}

export function isValidCoachSlug(slug: string): boolean {
  return slug in coaches;
}
