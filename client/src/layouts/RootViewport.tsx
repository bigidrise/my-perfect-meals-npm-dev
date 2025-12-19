import React from "react";

export function RootViewport({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="root-viewport"
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "black",
      }}
    >
      {children}
    </div>
  );
}
