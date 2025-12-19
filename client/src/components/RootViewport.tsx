import { ReactNode, useEffect, useRef, createContext, useContext } from "react";
import { useLocation } from "wouter";

const ScrollContainerContext = createContext<React.RefObject<HTMLElement> | null>(null);

export function useScrollContainer() {
  return useContext(ScrollContainerContext);
}

interface RootViewportProps {
  children: ReactNode;
}

/**
 * RootViewport - iOS Scroll Containment Fix
 * 
 * Architecture (CRITICAL for iOS):
 * - FIXED outer shell that NEVER scrolls
 * - SINGLE scroll container inside
 * - Pages handle their own safe-area padding for headers
 * 
 * DO NOT add safe-area padding here - pages already handle it.
 * Adding it here causes double padding on iOS.
 */
export default function RootViewport({ children }: RootViewportProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  // Reset scroll position on route changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [location]);

  return (
    <ScrollContainerContext.Provider value={scrollRef as React.RefObject<HTMLElement>}>
      {/* FIXED SHELL: Never scrolls, contains single scroll container */}
      <div 
        ref={scrollRef}
        className="fixed inset-0 bg-black ios-scroll-container"
        style={{ 
          height: '100dvh',
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
        }}
      >
        {children}
      </div>
    </ScrollContainerContext.Provider>
  );
}
