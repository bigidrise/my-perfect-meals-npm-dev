// server/services/creatorSystems/resolver.ts
// Resolves a user's active creator system from the registry.
// Always returns a valid system — never crashes, never returns undefined.

import { creatorSystems, type CreatorSystem } from "./registry";

export function resolveActiveSystem(user: { activeSystem?: string | null }): CreatorSystem {
  const key = user?.activeSystem;
  if (!key) return creatorSystems.default;
  return creatorSystems[key] ?? creatorSystems.default;
}
