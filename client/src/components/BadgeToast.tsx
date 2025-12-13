import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Zap, Award } from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: "bronze" | "silver" | "gold" | "platinum";
  earnedAt?: string;
}

interface BadgeToastProps {
  badge?: BadgeData;
}

export const BadgeToast = ({ badge }: BadgeToastProps) => {
  if (!badge) return null;

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "trophy": return Trophy;
      case "star": return Star;
      case "zap": return Zap;
      default: return Award;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "bronze": return "bg-amber-600";
      case "silver": return "bg-gray-500";
      case "gold": return "bg-yellow-500";
      case "platinum": return "bg-purple-600";
      default: return "bg-blue-500";
    }
  };

  const IconComponent = getIconComponent(badge.icon);

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 animate-in slide-in-from-right-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${getLevelColor(badge.level)}`}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-lg">
              Badge Earned! 🎉
            </div>
            <div className="text-sm opacity-90">
              {badge.name}
            </div>
            <div className="text-xs opacity-75 mt-1">
              {badge.description}
            </div>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {badge.level}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
