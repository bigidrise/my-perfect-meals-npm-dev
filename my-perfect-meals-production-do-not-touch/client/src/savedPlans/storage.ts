import type { SavedPlan } from './types';
const KEY = 'mpm:savedPlans:v1';

export function listPlans(): SavedPlan[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function savePlan(plan: SavedPlan) {
  const all = listPlans();
  const idx = all.findIndex(p => p.id === plan.id);
  if (idx >= 0) all[idx] = plan; else all.unshift(plan);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getPlan(id: string): SavedPlan | undefined {
  return listPlans().find(p => p.id === id);
}

export function deletePlan(id: string) {
  const next = listPlans().filter(p => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
}