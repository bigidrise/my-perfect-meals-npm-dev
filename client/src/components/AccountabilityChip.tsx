import React, { useEffect, useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AdherenceData {
  percent: number;
  ate: number;
  total: number;
}

export default function AccountabilityChip({ userId }: { userId: string }) {
  const [data, setData] = useState<AdherenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAdherenceData();
  }, [userId]);

  const fetchAdherenceData = async () => {
    try {
      const response = await fetch(apiUrl(`/api/adherence/${userId}`));
      if (response.ok) {
        const adherenceData = await response.json();
        setData(adherenceData);
      }
    } catch (error) {
      console.error("Failed to fetch adherence data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        Loading...
      </Badge>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Badge variant="outline" className="gap-2">
        <Minus className="h-3 w-3" />
        No meal data yet
      </Badge>
    );
  }

  const { percent, ate, total } = data;

  const getVariant = () => {
    if (percent >= 80) return "default"; // green
    if (percent >= 50) return "secondary"; // yellow
    return "destructive"; // red
  };

  const getIcon = () => {
    if (percent >= 80) return <TrendingUp className="h-3 w-3" />;
    if (percent >= 50) return <Minus className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  const getBgColor = () => {
    if (percent >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (percent >= 50) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getBgColor()}`}>
      {getIcon()}
      <span>Accountability: {percent}%</span>
      <span className="text-xs opacity-75">({ate}/{total} meals)</span>
    </div>
  );
}