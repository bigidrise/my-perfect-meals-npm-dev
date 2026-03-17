export interface CoachServerConfig {
  slug: string;
  displayName: string;
  isFounder: boolean;
  userIdEnv: string;
  studioIdEnv: string;
}

export const coaches: Record<string, CoachServerConfig> = {
  idrise: {
    slug: "idrise",
    displayName: "Coach Idrise",
    isFounder: true,
    userIdEnv: "COACH_IDRISE_USER_ID",
    studioIdEnv: "COACH_IDRISE_STUDIO_ID",
  },
  // To add a new coach:
  // jen: {
  //   slug: "jen",
  //   displayName: "Coach Jen",
  //   isFounder: false,
  //   userIdEnv: "COACH_JEN_USER_ID",
  //   studioIdEnv: "COACH_JEN_STUDIO_ID",
  // },
};

export interface ResolvedCoach {
  slug: string;
  displayName: string;
  isFounder: boolean;
  userId: string;
  studioId: string;
}

export function resolveCoach(slug: string): ResolvedCoach | null {
  const config = coaches[slug];
  if (!config) return null;

  const userId = process.env[config.userIdEnv];
  const studioId = process.env[config.studioIdEnv];

  if (!userId || !studioId) {
    console.error(
      `[CoachConfig] Missing env vars for coach "${slug}": ` +
      `${config.userIdEnv}=${userId ? "SET" : "MISSING"}, ` +
      `${config.studioIdEnv}=${studioId ? "SET" : "MISSING"}`
    );
    return null;
  }

  return {
    slug: config.slug,
    displayName: config.displayName,
    isFounder: config.isFounder,
    userId,
    studioId,
  };
}

export function isValidCoachSlug(slug: string): boolean {
  return slug in coaches;
}
