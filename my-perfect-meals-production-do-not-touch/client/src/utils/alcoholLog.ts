// No UI imports here — logic only.
import { apiUrl } from '@/lib/resolveApiBase';

export function computeAlcoholMetrics(volumeMl: number, abvPercent: number) {
  const abv = abvPercent / 100;
  const gramsAlcohol = volumeMl * abv * 0.789; // density of ethanol
  const standardDrinks = +(gramsAlcohol / 14).toFixed(2); // US standard
  const kcal = Math.round(gramsAlcohol * 7); // 7 kcal/g
  return { gramsAlcohol: +gramsAlcohol.toFixed(1), standardDrinks, kcal };
}

export async function logAlcoholToBiometrics({
  userId,
  drinkType,
  volumeMl,
  abvPercent,
  notes,
  loggedAt = new Date().toISOString(), // UTC
}: {
  userId: string;
  drinkType: string;
  volumeMl: number;
  abvPercent: number;
  notes?: string;
  loggedAt?: string;
}) {
  const { gramsAlcohol, standardDrinks, kcal } = computeAlcoholMetrics(volumeMl, abvPercent);

  const res = await fetch(apiUrl(`/api/users/${userId}/alcohol-logs`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      loggedAt,
      drinkType,
      volumeMl,
      abvPercent,
      standardDrinks,
      kcal,
      notes: notes || undefined,
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const data = await res.json();
  // Notify dashboards to refresh
  window.dispatchEvent(new Event("macros:updated"));
  window.dispatchEvent(new Event("alcohol:updated"));
  return data;
}