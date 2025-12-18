import React from "react";

type Props = {
  pref: string; setPref: (v: string) => void;
  med: string;  setMed: (v: string) => void;
};

export default function TempDietOverrides({ pref, setPref, med, setMed }: Props) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm text-white/80 mb-1">Dietary Preference (e.g., Mediterranean, Keto, Vegetarian)</label>
        <input
          value={pref}
          onChange={(e) => setPref(e.target.value)}
          placeholder="Mediterranean"
          className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50"
        />
        <p className="text-xs text-white/60 mt-1">Used when no medical override is set.</p>
      </div>
      <div>
        <label className="block text-sm text-white/80 mb-1">Medical Necessity Override (optional)</label>
        <input
          value={med}
          onChange={(e) => setMed(e.target.value)}
          placeholder="Type 2 diabetes friendly"
          className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50"
        />
        <p className="text-xs text-white/60 mt-1">Overrides dietary preference if provided.</p>
      </div>
    </div>
  );
}