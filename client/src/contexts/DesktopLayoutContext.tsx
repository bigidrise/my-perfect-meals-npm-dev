import { createContext, useContext } from "react";

const DesktopLayoutContext = createContext(false);

export const DesktopLayoutProvider = DesktopLayoutContext.Provider;

export function useInDesktopLayout(): boolean {
  return useContext(DesktopLayoutContext);
}
