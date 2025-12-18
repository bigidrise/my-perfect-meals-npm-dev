import React from "react";
import BadgeRow from "./BadgeRow";
import BadgeIcon from "./BadgeIcon";
import { findBadgeDefinition, getBadgeDescription } from "./BadgeRegistry";

interface BadgeItem {
  label: string;
  desc?: string;
  key?: string;
}

interface BadgeGroupProps {
  badges: BadgeItem[];
  className?: string;
  showIcons?: boolean;
  sortByPriority?: boolean;
}

export default function BadgeGroup({
  badges,
  className = "",
  showIcons = true,
  sortByPriority = true
}: BadgeGroupProps) {
  // Deduplicate badges by label
  const unique = Array.from(
    new Map(badges.map(b => [b.label.toLowerCase(), b])).values()
  );

  // Enrich badges with registry data and assign priority
  const enriched = unique.map(badge => {
    const definition = findBadgeDefinition(badge.label);
    const priorityMap = { critical: 0, important: 1, info: 2, default: 3 };

    return {
      ...badge,
      desc: badge.desc || getBadgeDescription(badge.label),
      type: definition?.type || "default",
      priority: priorityMap[definition?.type || "default"]
    };
  });

  // Sort by priority if enabled
  const sorted = sortByPriority
    ? enriched.sort((a, b) => a.priority - b.priority)
    : enriched;

  return (
    <div className={`space-y-3 ${className}`}>
      {sorted.map((badge, i) => (
        <div className="flex gap-2 items-start" key={badge.key || badge.label || i}>
          {showIcons && (
            <BadgeIcon
              type={badge.label}
              size={28}
              className="mt-0.5"
            />
          )}

          <BadgeRow
            label={badge.label}
            desc={badge.desc}
            type={badge.type}
            showDot={!showIcons}
            className="flex-1"
          />
        </div>
      ))}
    </div>
  );
}