
import React from "react";

interface BadgeDotProps {
  variant?: "safe" | "warning" | "alert" | "info" | "neutral" | "medical" | "premium";
  className?: string;
}

const DOT_COLORS = {
  safe: "bg-green-500",
  warning: "bg-yellow-500",
  alert: "bg-red-500 animate-pulse",
  info: "bg-blue-500",
  neutral: "bg-white/70",
  medical: "bg-yellow-500",
  premium: "bg-purple-500"
};

export default function BadgeDot({ variant = "neutral", className = "" }: BadgeDotProps) {
  const color = DOT_COLORS[variant];
  
  return (
    <span className={`inline-flex h-2 w-2 rounded-full ${color} ${className}`} />
  );
}
