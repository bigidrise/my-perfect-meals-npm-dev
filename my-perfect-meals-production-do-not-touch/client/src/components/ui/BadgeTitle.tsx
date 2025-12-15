
import React from "react";

interface BadgeTitleProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export default function BadgeTitle({ children, icon, className = "" }: BadgeTitleProps) {
  return (
    <h4 className={`text-sm font-semibold text-white/90 flex items-center gap-2 ${className}`}>
      {icon}
      {children}
    </h4>
  );
}
