import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface PageTitleContextValue {
  title: string;
  setTitle: (title: string) => void;
  clearTitle: () => void;
}

const PageTitleContext = createContext<PageTitleContextValue>({
  title: "",
  setTitle: () => {},
  clearTitle: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState("");
  const setTitle = useCallback((t: string) => setTitleState(t), []);
  const clearTitle = useCallback(() => setTitleState(""), []);

  return (
    <PageTitleContext.Provider value={{ title, setTitle, clearTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function useCurrentPageTitle(): string {
  return useContext(PageTitleContext).title;
}

export function usePageTitle(title: string): void {
  const { setTitle, clearTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => clearTitle();
  }, [title]);
}
