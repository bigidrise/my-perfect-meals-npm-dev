import { useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useIsDesktop } from '@/hooks/useIsDesktop';
type BadgeItem = { key: string; label: string; description?: string; };

function getBadgeColor(label: string): string {
  if (label.includes('✅') || label.toLowerCase().includes('safe') || label.toLowerCase().includes('friendly')) {
    return 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300';
  }
  if (label.includes('⚠️') || label.toLowerCase().includes('warning') || label.toLowerCase().includes('high')) {
    return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300';
  }
  if (label.includes('❌') || label.toLowerCase().includes('alert') || label.toLowerCase().includes('contains')) {
    return 'bg-red-100 text-red-800 hover:bg-red-200 border-red-300';
  }
  return 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300';
}

export default function MedicalBadges({ badges }: { badges: BadgeItem[] }) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);

  if (!badges?.length) return null;

  // Desktop: hover tooltips on each badge
  if (isDesktop) {
    return (
      <div className="flex flex-wrap gap-1">
        {badges.map(b => (
          <Tooltip key={b.key}>
            <TooltipTrigger asChild>
              <Badge aria-label={b.label} className={`rounded-full text-xs ${getBadgeColor(b.label)}`}>
                {b.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-sm">
              {b.description || b.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

  // Mobile: one compact button that opens a bottom sheet with ONLY this card's badges
  return (
    <>
      <button
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
        aria-label="Show medical badges"
        onClick={() => setOpen(true)}
      >
        <Info className="w-3 h-3" />
        Health Info ({badges.length})
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-auto">
          <SheetHeader>
            <SheetTitle>Health badges for this meal</SheetTitle>
            <SheetDescription className="text-sm">
              These apply to this specific recipe, based on your profile.
            </SheetDescription>
          </SheetHeader>
          <div className="py-3 space-y-2">
            {badges.map(b => (
              <div key={b.key} className={`p-3 border rounded-2xl ${getBadgeColor(b.label).includes('green') ? 'bg-green-50 border-green-200' : getBadgeColor(b.label).includes('yellow') ? 'bg-yellow-50 border-yellow-200' : getBadgeColor(b.label).includes('red') ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`font-medium ${getBadgeColor(b.label).includes('green') ? 'text-green-800' : getBadgeColor(b.label).includes('yellow') ? 'text-yellow-800' : getBadgeColor(b.label).includes('red') ? 'text-red-800' : 'text-blue-800'}`}>{b.label}</div>
                <div className="text-sm opacity-80">{b.description || 'No description'}</div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}