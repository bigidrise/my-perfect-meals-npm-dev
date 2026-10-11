import { developmentStudioLoadingEnabled } from "./developmentStudioLoading";

const destinations = {
  "/pro-portal": { label: "Pro Portal", load: () => import("@/pages/ProPortal") },
  "/pro/clients": { label: "Pro clients", load: () => import("@/pages/pro/ProClients") },
  "/pro/physician-clients": { label: "Clinic clients", load: () => import("@/pages/pro/ProClientsPhysician") },
  "/care-team": { label: "Care Team", load: () => import("@/pages/CareTeam") },
  "/care-team/physician": { label: "Care Team", load: () => import("@/pages/care-team/PhysicianCareTeam") },
  "/care-team/trainer": { label: "Care Team", load: () => import("@/pages/care-team/TrainerCareTeam") },
};

export type StudioTimingStage = "navigation" | "code" | "workspace" | "agreements" | "certification" | "authorized-page";
type Outcome = "ready" | "verified" | "not-required" | "denied" | "error";
export type StudioTimingRecord = {
  sequence: number;
  destination: string;
  stages: { stage: StudioTimingStage; elapsedMs: number; outcome: Outcome }[];
};
const records: StudioTimingRecord[] = [];
const codePromises = new Map<string, Promise<unknown>>();
let sequence = 0;
let current: StudioNavigationTiming | null = null;
const now = () => performance.now();

export function isStudioTransitionRoute(route: string): route is keyof typeof destinations {
  return Object.prototype.hasOwnProperty.call(destinations, route);
}

/** Code only: importing a module never mounts the page or requests page data here. */
export function preloadStudioPage(route: string): Promise<unknown> {
  if (!developmentStudioLoadingEnabled || !isStudioTransitionRoute(route)) return Promise.resolve();
  const existing = codePromises.get(route);
  if (existing) return existing;
  const pending = destinations[route].load().catch(error => {
    codePromises.delete(route);
    throw error;
  });
  codePromises.set(route, pending);
  return pending;
}

/** Founder authority is resolved asynchronously: warm the other code-only destination too. */
export function preloadStudioDemoPage(route: string): Promise<unknown> {
  if (!developmentStudioLoadingEnabled || !isStudioTransitionRoute(route)) return Promise.resolve();
  const key = "studio-demo-code";
  const existing = codePromises.get(key);
  if (existing) return existing;
  const pending = import("@/pages/pro/DemoPhysicianWorkspace").catch(error => {
    codePromises.delete(key);
    throw error;
  });
  codePromises.set(key, pending);
  return pending;
}

export type StudioNavigationTiming = {
  route: string;
  start: (stage: StudioTimingStage) => void;
  finish: (stage: StudioTimingStage, outcome: Outcome) => void;
  codeLoaded: (variant: "professional" | "demo", outcome: "ready" | "error") => void;
  selectCode: (variant: "professional" | "demo") => void;
};

/** Bounded, memory-only, no IDs, query strings, API payloads, storage, or logging. */
export function beginStudioNavigation(route: string): StudioNavigationTiming | null {
  if (!developmentStudioLoadingEnabled || !isStudioTransitionRoute(route)) return null;
  const started = now();
  const starts = new Map<StudioTimingStage, number>([["navigation", started], ["code", started]]);
  const done = new Set<StudioTimingStage>();
  const codeCandidates = new Map<string, { at: number; outcome: "ready" | "error" }>();
  let selectedCode: "professional" | "demo" | undefined;
  const record: StudioTimingRecord = { sequence: ++sequence, destination: destinations[route].label, stages: [] };
  const recordSelectedCode = () => {
    const loaded = selectedCode && codeCandidates.get(selectedCode);
    if (!loaded || done.has("code")) return;
    done.add("code");
    record.stages.push({ stage: "code", elapsedMs: Math.round(loaded.at - started), outcome: loaded.outcome });
  };
  records.push(record);
  if (records.length > 40) records.shift();
  current = {
    route,
    codeLoaded(variant, outcome) {
      if (!codeCandidates.has(variant)) codeCandidates.set(variant, { at: now(), outcome });
      recordSelectedCode();
    },
    selectCode(variant) { selectedCode = variant; recordSelectedCode(); },
    start(stage) { if (!starts.has(stage)) starts.set(stage, now()); },
    finish(stage, outcome) {
      if (done.has(stage)) return;
      done.add(stage);
      record.stages.push({ stage, elapsedMs: Math.round(now() - (starts.get(stage) ?? started)), outcome });
    },
  };
  return current;
}

export function currentStudioNavigation(route: string): StudioNavigationTiming | null {
  if (!developmentStudioLoadingEnabled) return null;
  return current?.route === route ? current : beginStudioNavigation(route);
}

export function readStudioNavigationTimings(): StudioTimingRecord[] {
  if (!developmentStudioLoadingEnabled) return [];
  return records.map(record => ({ ...record, stages: record.stages.map(stage => ({ ...stage })) }));
}
