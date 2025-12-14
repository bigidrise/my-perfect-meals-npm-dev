import { apiUrl } from '@/lib/resolveApiBase';

export async function getConstraints(userId: string) {
  const res = await fetch(apiUrl(`/api/meal-engine/constraints?userId=${userId}`));
  if (!res.ok) throw new Error("constraints_fetch_failed");
  const data = await res.json();
  return data.constraints as any;
}

async function getCandidate(mealType: "breakfast"|"lunch"|"dinner"|"snack") {
  const res = await fetch(apiUrl("/api/generation/candidate"), { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ mealType }) 
  });
  if (!res.ok) throw new Error("candidate_failed");
  return res.json();
}

export async function generateMealWithConstraints(userId: string, mealType: "breakfast"|"lunch"|"dinner"|"snack") {
  const constraints = await getConstraints(userId);

  for (let attempt = 0; attempt < 4; attempt++) {
    const candidate = await getCandidate(mealType);
    const res = await fetch(apiUrl("/api/generation/enforce"), { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ candidate, constraints, mealType }) 
    });
    if (res.status === 409) continue; // rejected; try another
    if (!res.ok) throw new Error("enforce_failed");
    const meal = await res.json();
    return meal;
  }
  throw new Error("no_candidate_satisfied_constraints");
}