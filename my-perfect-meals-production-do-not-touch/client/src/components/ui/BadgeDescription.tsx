
import React from "react";

interface BadgeDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export default function BadgeDescription({ children, className = "" }: BadgeDescriptionProps) {
  return (
    <div className={`text-white/80 text-xs leading-snug ${className}`}>
      {children}
    </div>
  );
}
