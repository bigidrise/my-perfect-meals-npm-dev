import React from "react";

interface PageShellProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  backButton?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export default function PageShell({ title, children, actions, backButton, className, headerClassName }: PageShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black">
      <div className={`mx-auto max-w-7xl p-4 sm:p-6 ${className || ''}`}>
        <div className={`mb-4 flex items-center justify-between ${headerClassName ? `p-4 ${headerClassName}` : ''}`}>
          <div className="flex items-center gap-3">
            {backButton}
            <h1 className="text-2xl font-semibold text-zinc-50">{title}</h1>
          </div>
          <div className="flex gap-2">{actions}</div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-xl">
          <div className="p-3 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
