import { apiUrl } from '@/lib/resolveApiBase';

export async function logMeal(mealInstanceId: string, body: any = {}) {
  const r = await fetch(apiUrl(`/api/meals/${mealInstanceId}/log`), {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Failed to log meal');
  return r.json();
}

export async function skipMeal(mealInstanceId: string) {
  const r = await fetch(apiUrl(`/api/meals/${mealInstanceId}/skip`), { 
    method: 'POST' 
  });
  if (!r.ok) throw new Error('Failed to skip meal');
  return r.json();
}

export async function replaceAndOptionalLog(mealInstanceId: string, body: any) {
  const r = await fetch(apiUrl(`/api/meals/${mealInstanceId}/replace-and-optional-log`), {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Failed to replace/log');
  return r.json();
}