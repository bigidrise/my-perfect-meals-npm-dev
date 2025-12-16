import React from "react";

export default function StatCard({ label, value, suffix, sub }: {
  label: string; value: number; suffix?: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold">
        {Math.round(value)} {suffix || ""}
      </div>
      {sub && <div className="text-xs opacity-60">{sub}</div>}
    </div>
  );
}
