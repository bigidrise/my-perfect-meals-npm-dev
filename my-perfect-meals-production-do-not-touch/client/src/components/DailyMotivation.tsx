import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface DailyMotivationProps {
  userId: number;
}

export default function DailyMotivation({ userId }: DailyMotivationProps) {
  const { data: motivation, isLoading, refetch } = useQuery({
    queryKey: [`/api/users/${userId}/daily-motivation`],
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Card className="w-full bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-500" />
          Today's Motivation
        </CardTitle>
        <CardDescription>
          {motivation?.personalized 
            ? "Your personalized daily inspiration" 
            : "A little inspiration for your wellness journey"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center space-y-3">
            <Loader2 className="w-6 h-6 text-purple-400 mx-auto animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Crafting your personal motivation...
            </p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="relative">
              <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-3" />
              <blockquote className="text-lg font-medium text-gray-800 dark:text-gray-200 italic leading-relaxed">
                "{motivation?.quote || "Every healthy choice you make today builds the strong, vibrant future you deserve."}"
              </blockquote>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {motivation?.personalized ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Personalized for your wellness journey
                </span>
              ) : (
                "Daily inspiration"
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-center pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh Quote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
