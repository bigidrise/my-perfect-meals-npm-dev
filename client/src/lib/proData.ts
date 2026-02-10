// client/src/lib/proData.ts
export type Slot = 'breakfast'|'lunch'|'dinner'|'snack';

export type ProRole =
  | "trainer"
  | "doctor"
  | "dietitian"
  | "nutritionist"
  | "pa"
  | "np"
  | "rn";

export type WorkspaceType = "trainer" | "clinician";
export type BuilderType = "general" | "performance";

export type ClientProfile = {
  id: string;
  name: string;
  email?: string;
  notes?: string;
  role?: ProRole;
  archived?: boolean;
  workspace?: WorkspaceType;
  assignedBuilder?: BuilderType;
  userId?: string;
  clientUserId?: string;
  studioId?: string;
  activeBoardId?: string;
  dbBacked?: boolean;
};

export type StarchStrategy = "one" | "flex";

export type Targets = {
  protein: number;
  starchyCarbs: number;
  fibrousCarbs: number;
  fat: number;
  // Starch Meal Strategy: "one" = 1 starch meal/day (default), "flex" = 2 meals
  starchStrategy?: StarchStrategy;
  flags?: {
    // Medical flags (for doctors/dietitians)
    lowSodium?: boolean;
    diabetesFriendly?: boolean;
    glp1?: boolean;
    cardiac?: boolean;
    renal?: boolean;
    postBariatric?: boolean;
    
    // Performance flags (for trainers)
    highProtein?: boolean;
    carbCycling?: boolean;
    antiInflammatory?: boolean;
  };
  allergens?: string[];
  carbDirective?: {
    starchyCapG?: number | null;
    fibrousFloorG?: number | null;
    addedSugarCapG?: number | null;
  };
};

export type ClinicalAdvisoryToggle = {
  id: string;
  enabled: boolean;
  appliedAt?: string;
  appliedBy?: string;
};

export type ClinicalAdvisory = {
  menopause?: ClinicalAdvisoryToggle;
  insulinResistance?: ClinicalAdvisoryToggle;
  highStress?: ClinicalAdvisoryToggle;
};

export type ClinicalContext = {
  role: ProRole;
  diagnosis?: string;
  clinicalTags?: (
    | "GLP-1"
    | "Cardiac"
    | "Renal"
    | "Bariatric"
    | "Post-Op"
    | "Diabetes"
    | "General"
  )[];
  followupWeeks?: 4 | 8 | 12;
  patientNote?: string;
  coachNote?: string;
  advisory?: ClinicalAdvisory;
};

export type Prefs = {
  dislikes: string[];
  allergens: string[];
  cuisines: string[];
  effort: 'low'|'standard'|'high';
  budget: 'low'|'med'|'high';
};

export type PlanItem = {
  day: number;
  slot: Slot;
  label: string;
  kcal: number; p: number; c: number; f: number;
};

type FollowUp = {
  id: string;
  clientId: string;
  dueAt: string;
  note: string;
  done?: boolean;
};

type ProStoreState = {
  clients: ClientProfile[];
  targets: Record<string, Targets>;
  prefs: Record<string, Prefs>;
  plans: Record<string, PlanItem[]>;
  context: Record<string, ClinicalContext>;
  followups: FollowUp[];
};

const LS_KEY = 'mpm_prostore_v2';

function loadState(): ProStoreState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { clients: [], targets: {}, prefs: {}, plans: {}, context: {}, followups: [] };
    const parsed = JSON.parse(raw);

    return {
      clients: parsed.clients ?? [],
      targets: parsed.targets ?? {},
      prefs: parsed.prefs ?? {},
      plans: parsed.plans ?? {},
      context: parsed.context ?? {},
      followups: parsed.followups ?? [],
    } as ProStoreState;
  } catch {
    return { clients: [], targets: {}, prefs: {}, plans: {}, context: {}, followups: [] };
  }
}

function saveState(s: ProStoreState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function uid(prefix = "fu"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

let state = loadState();

type Tag = 'low_sodium'|'diabetes_friendly'|'glp1_support';
type BankItem = { slot: Slot; label: string; kcal: number; p:number; c:number; f:number; tags: Tag[]; cuisines?: string[] };

const RECIPE_BANK: BankItem[] = [
  { slot:'breakfast', label:'Greek Yogurt, Berries, Chia', kcal:320, p:28, c:32, f:8,  tags:['diabetes_friendly','glp1_support'] },
  { slot:'breakfast', label:'Egg Whites + Spinach Omelet', kcal:290, p:32, c:6,  f:12, tags:['low_sodium','diabetes_friendly','glp1_support'] },
  { slot:'breakfast', label:'Oats, Whey, Blueberries',     kcal:360, p:28, c:45, f:8,  tags:['diabetes_friendly','glp1_support'] },
  { slot:'breakfast', label:'Tofu Scramble + Veg',         kcal:310, p:26, c:14, f:14, tags:['low_sodium','diabetes_friendly','glp1_support'] },

  { slot:'lunch', label:'Turkey & Quinoa Bowl (no added salt)', kcal:520, p:42, c:55, f:12, tags:['low_sodium','diabetes_friendly','glp1_support'] },
  { slot:'lunch', label:'Salmon, Brown Rice, Broccoli',        kcal:560, p:40, c:50, f:18, tags:['diabetes_friendly','glp1_support'] },
  { slot:'lunch', label:'Tofu Veg Stir-Fry (low-sodium tamari)',kcal:500, p:32, c:48, f:16, tags:['low_sodium','diabetes_friendly','glp1_support'] },
  { slot:'lunch', label:'Chicken, Farro, Kale (no added salt)', kcal:540, p:44, c:52, f:14, tags:['low_sodium','diabetes_friendly','glp1_support'] },

  { slot:'dinner', label:'Grilled Chicken, Sweet Potato, Greens', kcal:600, p:45, c:60, f:14, tags:['diabetes_friendly','glp1_support'] },
  { slot:'dinner', label:'Lean Beef, Farro, Asparagus (no salt)', kcal:590, p:42, c:50, f:18, tags:['low_sodium','glp1_support'] },
  { slot:'dinner', label:'Shrimp Zoodles + Marinara (low-sodium)',kcal:520, p:38, c:40, f:16, tags:['low_sodium','diabetes_friendly','glp1_support'] },
  { slot:'dinner', label:'Baked Cod, Couscous, Green Beans',      kcal:560, p:44, c:48, f:16, tags:['diabetes_friendly','glp1_support'] },

  { slot:'snack', label:'Whey Protein Shake + Ice',   kcal:180, p:28, c:6,  f:2,  tags:['low_sodium','diabetes_friendly','glp1_support'] },
  { slot:'snack', label:'Cottage Cheese + Cucumber',  kcal:200, p:24, c:8,  f:6,  tags:['diabetes_friendly','glp1_support'] },
  { slot:'snack', label:'Apple + 1 tbsp Almond Butter', kcal:210, p:6,  c:22, f:12, tags:['glp1_support'] },
  { slot:'snack', label:'Roasted Chickpeas (no added salt)', kcal:190, p:9, c:28, f:4, tags:['low_sodium','diabetes_friendly','glp1_support'] },
];

function mustTagsFromTargets(t: Targets): Tag[] {
  const tags: Tag[] = [];
  if (t.flags?.lowSodium) tags.push('low_sodium');
  if (t.flags?.diabetesFriendly) tags.push('diabetes_friendly');
  if (t.flags?.glp1) tags.push('glp1_support');
  return tags;
}

function bankFor(slot: Slot, t: Targets, p: Prefs): BankItem[] {
  const must = mustTagsFromTargets(t);
  const base = RECIPE_BANK.filter(i => i.slot === slot);
  const byTags = must.length ? base.filter(i => must.every(tag => i.tags.includes(tag))) : base;

  const avoid = new Set(
    [...(p.dislikes||[]), ...(p.allergens||[])].map(s => s.toLowerCase().trim()).filter(Boolean)
  );
  const byAvoid = byTags.filter(i => {
    const hay = i.label.toLowerCase();
    for (const a of avoid) if (a && hay.includes(a)) return false;
    return true;
  });

  const byCuisine = (p.cuisines?.length)
    ? byAvoid.filter(i => !i.cuisines || i.cuisines.some(c => p.cuisines!.includes(c)))
    : byAvoid;

  return byCuisine.length ? byCuisine : base;
}

const SLOT_WEIGHTS: Record<Slot, number> = {
  breakfast: 0.25,
  lunch:     0.35,
  dinner:    0.30,
  snack:     0.10,
};

function scaleMacrosToKcal(item: BankItem, targetKcal: number): Pick<BankItem,'kcal'|'p'|'c'|'f'> {
  if (!targetKcal || targetKcal <= 0) return { kcal: item.kcal, p:item.p, c:item.c, f:item.f };
  const current = Math.max(1, item.kcal);
  const factor = targetKcal / current;
  const f2 = Math.min(1.35, Math.max(0.75, factor));
  return {
    kcal: Math.round(item.kcal * f2),
    p: Math.round(item.p * f2),
    c: Math.round(item.c * f2),
    f: Math.round(item.f * f2),
  };
}

export const proStore = {
  listClients(): ClientProfile[] {
    return state.clients;
  },
  getClient(id: string): ClientProfile | undefined {
    return state.clients.find((c) => c.id === id);
  },
  saveClients(list: ClientProfile[]) {
    state.clients = list;
    saveState(state);
  },
  upsertClient(c: ClientProfile) {
    const i = state.clients.findIndex((x) => x.id === c.id);
    if (i >= 0) state.clients[i] = { ...state.clients[i], ...c };
    else state.clients.unshift(c);
    saveState(state);
  },
  
  archiveClient(id: string) {
    const client = state.clients.find(c => c.id === id);
    if (client) {
      client.archived = true;
      saveState(state);
    }
  },
  
  restoreClient(id: string) {
    const client = state.clients.find(c => c.id === id);
    if (client) {
      client.archived = false;
      saveState(state);
    }
  },
  
  deleteClient(id: string) {
    state.clients = state.clients.filter(c => c.id !== id);
    delete state.targets[id];
    delete state.prefs[id];
    delete state.plans[id];
    delete state.context[id];
    state.followups = state.followups.filter(f => f.clientId !== id);
    saveState(state);
  },

  getTargets(clientId: string): Targets {
    const stored = state.targets[clientId];
    
    // Migration: Handle old data format (kcal, carbs) → new format (protein, starchyCarbs, fibrousCarbs, fat)
    if (stored && ('kcal' in stored || 'carbs' in stored)) {
      const legacy = stored as any;
      const migrated: Targets = {
        protein: legacy.protein || 160,
        starchyCarbs: legacy.carbs ? Math.round(legacy.carbs * 0.7) : 180,
        fibrousCarbs: legacy.carbs ? Math.round(legacy.carbs * 0.3) : 50,
        fat: legacy.fat || 70,
        starchStrategy: 'one',
        flags: legacy.flags || {},
        carbDirective: legacy.carbDirective || {},
      };
      // Save migrated version
      state.targets[clientId] = migrated;
      saveState(state);
      return migrated;
    }
    
    return (
      stored ?? {
        protein: 160,
        starchyCarbs: 180,
        fibrousCarbs: 50,
        fat: 70,
        starchStrategy: 'one',
        flags: {},
        carbDirective: {},
      }
    );
  },
  setTargets(clientId: string, t: Targets) {
    state.targets[clientId] = {
      ...t,
      protein: Math.max(0, Number(t.protein || 0)),
      starchyCarbs: Math.max(0, Number(t.starchyCarbs || 0)),
      fibrousCarbs: Math.max(0, Number(t.fibrousCarbs || 0)),
      fat: Math.max(0, Number(t.fat || 0)),
      starchStrategy: t.starchStrategy || 'one',
      carbDirective: {
        starchyCapG:
          t.carbDirective?.starchyCapG == null
            ? null
            : Math.max(0, Number(t.carbDirective?.starchyCapG || 0)),
        fibrousFloorG:
          t.carbDirective?.fibrousFloorG == null
            ? null
            : Math.max(0, Number(t.carbDirective?.fibrousFloorG || 0)),
        addedSugarCapG:
          t.carbDirective?.addedSugarCapG == null
            ? null
            : Math.max(0, Number(t.carbDirective?.addedSugarCapG || 0)),
      },
    };
    saveState(state);
  },

  getPrefs(clientId: string): Prefs {
    return state.prefs[clientId] ?? { dislikes:[], allergens:[], cuisines:[], effort:'standard', budget:'med' };
  },
  setPrefs(clientId: string, p: Prefs) {
    state.prefs[clientId] = p;
    saveState(state);
  },

  getPlan(clientId: string): PlanItem[] {
    return state.plans[clientId] ?? [];
  },
  setPlan(clientId: string, items: PlanItem[]) {
    state.plans[clientId] = items.sort((a,b)=> a.day - b.day || a.slot.localeCompare(b.slot));
    saveState(state);
  },

  getContext(clientId: string): ClinicalContext {
    const role =
      state.context[clientId]?.role ||
      state.clients.find((c) => c.id === clientId)?.role ||
      "trainer";
    return state.context[clientId] ?? { role };
  },
  setContext(clientId: string, ctx: ClinicalContext) {
    state.context[clientId] = {
      role: ctx.role,
      diagnosis: ctx.diagnosis?.trim() || undefined,
      clinicalTags: ctx.clinicalTags?.length ? [...new Set(ctx.clinicalTags)] : undefined,
      followupWeeks: ctx.followupWeeks,
      patientNote: ctx.patientNote?.trim() || undefined,
      coachNote: ctx.coachNote?.trim() || undefined,
      advisory: ctx.advisory,
    };
    saveState(state);
  },

  scheduleFollowUp(
    clientId: string,
    weeks: 4 | 8 | 12,
    note: string,
  ): FollowUp {
    const due = new Date();
    due.setDate(due.getDate() + weeks * 7);
    const item: FollowUp = {
      id: uid("fu"),
      clientId,
      dueAt: due.toISOString(),
      note,
      done: false,
    };
    state.followups.unshift(item);
    saveState(state);
    return item;
  },

  listFollowUps(clientId: string): FollowUp[] {
    return state.followups
      .filter((f) => f.clientId === clientId)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  },

  markFollowUpDone(id: string): void {
    const i = state.followups.findIndex((f) => f.id === id);
    if (i >= 0) {
      state.followups[i].done = true;
      saveState(state);
    }
  },
};

export function addMeal(clientId: string, day: number, slot: Slot, item: Omit<PlanItem,'day'|'slot'>) {
  const plan = proStore.getPlan(clientId);
  const without = plan.filter(pi => !(pi.day===day && pi.slot===slot));
  proStore.setPlan(clientId, [...without, { day, slot, ...item }]);
}

export async function generatePlan7d(clientId: string) {
  const t = proStore.getTargets(clientId);
  const p = proStore.getPrefs(clientId);

  // Calculate total calories from new macro structure
  const totalCarbs = (t.starchyCarbs || 0) + (t.fibrousCarbs || 0);
  const totalKcal = (t.protein * 4) + (totalCarbs * 4) + (t.fat * 9);

  const perSlotKcal: Record<Slot, number> = {
    breakfast: Math.round(totalKcal * SLOT_WEIGHTS.breakfast),
    lunch:     Math.round(totalKcal * SLOT_WEIGHTS.lunch),
    dinner:    Math.round(totalKcal * SLOT_WEIGHTS.dinner),
    snack:     Math.round(totalKcal * SLOT_WEIGHTS.snack),
  };

  const slots: Slot[] = ['breakfast','lunch','dinner','snack'];
  const items: PlanItem[] = [];

  const rot = (arr: BankItem[], offset: number) => arr[(offset) % arr.length];

  for (let day=1; day<=7; day++){
    for (const slot of slots){
      const candidates = bankFor(slot, t, p);
      const chosen = rot(candidates, day-1);
      const scaled = scaleMacrosToKcal(chosen, perSlotKcal[slot]);

      items.push({
        day,
        slot,
        label: chosen.label,
        kcal: scaled.kcal,
        p:    scaled.p,
        c:    scaled.c,
        f:    scaled.f,
      });
    }
  }

  proStore.setPlan(clientId, items);
  return items;
}
