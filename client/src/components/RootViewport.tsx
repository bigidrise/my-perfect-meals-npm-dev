import { ReactNode, useEffect, useRef, createContext, useContext } from "react";
import { useLocation } from "wouter";

const ScrollContainerContext = createContext<React.RefObject<HTMLElement> | null>(null);

export function useScrollContainer() {
  return useContext(ScrollContainerContext);
}

interface RootViewportProps {
  children: ReactNode;
}

export default function RootViewport({ children }: RootViewportProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const [location] = useLocation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [location]);

  return (
    <ScrollContainerContext.Provider value={scrollRef}>
      <div 
        className="fixed inset-0 flex flex-col bg-black"
        style={{ height: '100dvh' }}
      >
        <main 
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain ios-scroll"
        >
          {children}
        </main>
      </div>
    </ScrollContainerContext.Provider>
  );
}
