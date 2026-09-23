// Dev-1 is enabled. Production requires an explicit build-time opt-in; an
// unset or ambiguous value never exposes experimental Creator Menus.
// The server separately enforces CREATOR_MENU_ENABLED=true in Production.
export const ONE_TOUCH_CREATE_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_CREATOR_MENU_ENABLED === "true";