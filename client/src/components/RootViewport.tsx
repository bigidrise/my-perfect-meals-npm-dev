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
 * 1. Outer shell: FIXED, non-scrollable, owns safe-area padding
 * 2. Safe-area wrapper: NON-SCROLLABLE, sits ABOVE the scroll container
 * 3. Inner content: ONLY element that scrolls
 * 
 * This prevents iOS WKWebView from treating the entire viewport as scrollable,
 * which causes the "pull down and stays down" bug.
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
      {/* OUTER SHELL: Fixed, non-scrollable, fills viewport */}
      <div 
        className="fixed inset-0 flex flex-col bg-black"
        style={{ 
          height: '100dvh',
          overflow: 'hidden', // CRITICAL: Shell must never scroll
        }}
      >
        {/* SAFE-AREA WRAPPER: Non-scrollable, sits above scroll container */}
        <div 
          className="flex-shrink-0 bg-black"
          style={{ 
            paddingTop: 'env(safe-area-inset-top)',
          }}
        />
        
        {/* SCROLL CONTAINER: Only this element scrolls */}
        <div 
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-x-hidden bg-black"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>
      </div>
    </ScrollContainerContext.Provider>
  );
}
