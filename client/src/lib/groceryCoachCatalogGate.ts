// Isolated from portable helpers so Jest can mock Vite's compile-time gate.
export const groceryCoachCatalogEnabled = import.meta.env.DEV;
