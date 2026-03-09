import { apiUrl } from '@/lib/resolveApiBase';
import { getAuthHeaders } from '@/lib/auth';

export async function logMeal(mealInstanceId: string, body: any = {}) {
  const r = await fetch(apiUrl(`/api/meals/${mealInstanceId}/log`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, 
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Failed to log meal');
  return r.json();
}

export async function skipMeal(mealInstanceId: string) {
  const r = await fetch(apiUrl(`/api/meals/${mealInstanceId}/skip`), { 
    method: 'POST',
    credentials: 'include',
    headers: { ...getAuthHeaders() },
  });
  if (!r.ok) throw new Error('Failed to skip meal');
  return r.json();
}

export async function replaceAndOptionalLog(mealInstanceId: string, body: any) {
  const r = await fetch(apiUrl(`/api/meals/${mealInstanceId}/replace-and-optional-log`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, 
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Failed to replace/log');
  return r.json();
}
