import React from "react";
import { isIosNativeShell } from "@/lib/platform";

export function RootViewport({ children }: { children: React.ReactNode }) {
  const isIosNative = isIosNativeShell();
  
  return (
    <div
      id="root-viewport"
      style={{
        position: "fixed",
        inset: 0,
        height: isIosNative 
          ? "calc(100dvh + env(safe-area-inset-top, 0px))" 
          : "100dvh",
        width: "100%",
        overflowX: "hidden",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "none",
        background: "black",
        marginTop: isIosNative 
          ? "calc(env(safe-area-inset-top, 0px) * -1)" 
          : undefined,
      }}
    >
      {children}
    </div>
  );
}
