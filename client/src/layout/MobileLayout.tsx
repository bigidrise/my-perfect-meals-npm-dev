import { ReactNode } from "react";

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">{children}</div>
  );
}
