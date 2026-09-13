import React from "react";

export function RootViewport({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="root-viewport"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        overflowX: "clip",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorX: "none",
        overscrollBehaviorY: "contain",
        touchAction: "pan-y",
        background: "black",
      }}
    >
      {children}
    </div>
  );
}
