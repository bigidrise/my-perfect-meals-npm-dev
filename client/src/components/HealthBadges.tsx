import { Badge } from "@/components/ui/badge";

export interface HealthBadge {
  id: string;
  type: string;
  label: string;
  reason?: string;
}

interface HealthBadgesProps {
  badges: HealthBadge[];
  maxVisible?: number;
}

export function HealthBadges({ badges, maxVisible = 3 }: HealthBadgesProps) {
  const visibleBadges = badges.slice(0, maxVisible);
  const remainingCount = badges.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleBadges.map((badge) => (
        <Badge
          key={badge.id}
          variant="secondary"
          className="text-xs"
          title={badge.reason}
        >
          {badge.label}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}