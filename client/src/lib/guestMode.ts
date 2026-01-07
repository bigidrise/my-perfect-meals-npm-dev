// client/src/lib/guestMode.ts
// Guest Mode: Apple App Review Compliant - One-Day Experience

const GUEST_SESSION_KEY = "mpm_guest_session";
const GUEST_GENERATIONS_KEY = "mpm_guest_generations";
const MAX_GUEST_GENERATIONS = 4; // One full day: breakfast, lunch, dinner, snack

export interface GuestSession {
  isGuest: true;
  sessionId: string;
  startedAt: number;
  generationsUsed: number;
  dayBuilt: boolean;
}

export function startGuestSession(): GuestSession {
  const session: GuestSession = {
    isGuest: true,
    sessionId: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: Date.now(),
    generationsUsed: 0,
    dayBuilt: false,
  };
  
  sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(GUEST_GENERATIONS_KEY, "0");
  
  return session;
}

export function getGuestSession(): GuestSession | null {
  try {
    const stored = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as GuestSession;
  } catch {
    return null;
  }
}

export function isGuestMode(): boolean {
  return getGuestSession() !== null;
}

export function getGuestGenerationsRemaining(): number {
  const session = getGuestSession();
  if (!session) return 0;
  return Math.max(0, MAX_GUEST_GENERATIONS - session.generationsUsed);
}

export function canGuestGenerate(): boolean {
  return getGuestGenerationsRemaining() > 0;
}

export function incrementGuestGeneration(): boolean {
  const session = getGuestSession();
  if (!session) return false;
  
  if (session.generationsUsed >= MAX_GUEST_GENERATIONS) {
    return false;
  }
  
  session.generationsUsed += 1;
  sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(GUEST_GENERATIONS_KEY, session.generationsUsed.toString());
  
  return true;
}

export function markGuestDayBuilt(): void {
  const session = getGuestSession();
  if (!session) return;
  
  session.dayBuilt = true;
  sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
}

export function hasGuestBuiltDay(): boolean {
  const session = getGuestSession();
  return session?.dayBuilt ?? false;
}

export function endGuestSession(): void {
  sessionStorage.removeItem(GUEST_SESSION_KEY);
  sessionStorage.removeItem(GUEST_GENERATIONS_KEY);
}

// Pages guests CAN access
export const GUEST_ALLOWED_ROUTES = [
  "/welcome",
  "/guest-builder",
  "/macro-counter",
  "/weekly-meal-board",
  "/craving-creator",
  "/fridge-rescue",
  "/privacy-policy",
  "/terms",
];

// Pages that require account (show soft gate)
export const ACCOUNT_REQUIRED_ROUTES = [
  "/dashboard",
  "/shopping-list",
  "/procare-cover",
  "/care-team",
  "/pro-portal",
  "/diabetic-hub",
  "/glp1-hub",
  "/beach-body-meal-board",
];

export function isGuestAllowedRoute(path: string): boolean {
  return GUEST_ALLOWED_ROUTES.some(route => path.startsWith(route));
}

export function requiresAccount(path: string): boolean {
  return ACCOUNT_REQUIRED_ROUTES.some(route => path.startsWith(route));
}
