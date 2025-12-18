import { ReactNode } from "react";

interface RootViewportProps {
  children: ReactNode;
}

export default function RootViewport({ children }: RootViewportProps) {
  return (
    <div 
      className="fixed inset-0 flex flex-col bg-black"
      style={{ height: '100dvh' }}
    >
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain ios-scroll">
        {children}
      </main>
    </div>
  );
}
