// client/src/components/ProDietaryDirectives.tsx
// Simple component to show professional dietary directives on meal generator pages

import { useEffect, useState } from 'react';
import { getResolvedTargets, type ResolvedTargets } from '@/lib/macroResolver';
import { Stethoscope, Activity } from 'lucide-react';

export function ProDietaryDirectives() {
  const [resolved, setResolved] = useState<ResolvedTargets | null>(null);

  useEffect(() => {
    const targets = getResolvedTargets();
    if (targets.source === 'pro' && targets.flags) {
      setResolved(targets);
    }
  }, []);

  if (!resolved || !resolved.flags || resolved.source !== 'pro') {
    return null; // Don't show anything if no pro directives
  }

  const medicalFlags = [];
  const performanceFlags = [];

  // Medical flags
  if (resolved.flags.lowSodium) medicalFlags.push('Low-Sodium');
  if (resolved.flags.diabetesFriendly) medicalFlags.push('Diabetes-Friendly');
  if (resolved.flags.glp1) medicalFlags.push('GLP-1 Support');
  if (resolved.flags.cardiac) medicalFlags.push('Cardiac-Friendly');
  if (resolved.flags.renal) medicalFlags.push('Renal-Friendly');
  if (resolved.flags.postBariatric) medicalFlags.push('Post-Bariatric');

  // Performance flags  
  if (resolved.flags.highProtein) performanceFlags.push('High-Protein Focus');
  if (resolved.flags.carbCycling) performanceFlags.push('Carb Cycling');
  if (resolved.flags.antiInflammatory) performanceFlags.push('Anti-Inflammatory');

  const allFlags = [...medicalFlags, ...performanceFlags];

  if (allFlags.length === 0) {
    return null; // No flags set
  }

  const isMedical = medicalFlags.length > 0;
  const icon = isMedical ? Stethoscope : Activity;
  const Icon = icon;

  return (
    <div className="mb-4 rounded-xl border border-purple-400/40 bg-purple-900/20 backdrop-blur-sm p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon className="h-5 w-5 text-purple-300" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-purple-200 text-sm mb-1">
            {isMedical ? '🩺 Medical Dietary Directives' : '💪 Performance Directives'}
          </div>
          <div className="text-sm text-white/70 mb-2">
            Set by {resolved.setBy || 'your professional'}
          </div>
          <div className="flex flex-wrap gap-2">
            {allFlags.map(flag => (
              <span
                key={flag}
                className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-200 text-xs border border-purple-400/30"
              >
                {flag}
              </span>
            ))}
          </div>
          {resolved.allergens && resolved.allergens.length > 0 && (
            <div className="mt-2 text-xs text-white/60">
              <span className="font-semibold">Allergens to avoid:</span> {resolved.allergens.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
