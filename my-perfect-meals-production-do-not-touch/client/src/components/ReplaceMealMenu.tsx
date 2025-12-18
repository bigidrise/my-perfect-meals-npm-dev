import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, ChefHat, Utensils, BookOpen, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ReplaceMealMenuProps {
  isOpen: boolean;
  onClose: () => void;
  dayIndex: number;
  mealIndex: number; // 0=b,1=l,2=d,3=s
  currentMeal: any;
}

const slotName = (idx: number) => ["breakfast","lunch","dinner","snack"][idx] ?? "meal";

export function ReplaceMealMenu({
  isOpen,
  onClose,
  dayIndex,
  mealIndex,
  currentMeal,
}: ReplaceMealMenuProps) {
  const [cravingText, setCravingText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Deep-link targets for "Open in Creator"
  const returnPath = "/weekly-meal-board";
  const dlParams = useMemo(() => {
    const params = new URLSearchParams({
      mode: "replace",
      day: String(dayIndex),
      slot: String(mealIndex),
      return: returnPath,
    });
    return params.toString();
  }, [dayIndex, mealIndex]);

  const cravingCreatorHref = `/craving-creator?${dlParams}`;
  const fridgeRescueHref  = `/fridge-rescue?${dlParams}`;

  // Fetch meal templates for library
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/meal-templates", { 
      type: currentMeal?.type, 
      q: searchText || undefined,
      limit: 20 
    }],
    enabled: isOpen,
  });

  // Replace mutations (Quick Replace)
  const fridgeReplaceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/meals/replace/fridge`, {
        method: "POST",
        body: JSON.stringify({
          dayIndex,
          mealIndex,
          params: {}, // pantry filters later
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Meal replaced from Fridge Rescue!" });
      // Optional: if API returns { plan }, set cache immediately:
      if (data?.plan) queryClient.setQueryData(["weeklyPlan","current+meta"], data.plan);
      queryClient.invalidateQueries({ queryKey: ["weeklyPlan","current+meta"] });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Replace failed", description: error.message, variant: "destructive" });
    },
  });

  const cravingReplaceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/meals/replace/craving`, {
        method: "POST",
        body: JSON.stringify({
          dayIndex,
          mealIndex,
          want: cravingText,
          params: {},
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Meal replaced from Craving Creator!" });
      if (data?.plan) queryClient.setQueryData(["weeklyPlan","current+meta"], data.plan);
      queryClient.invalidateQueries({ queryKey: ["weeklyPlan","current+meta"] });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Replace failed", description: error.message, variant: "destructive" });
    },
  });

  const libraryReplaceMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest(`/api/meals/replace/library`, {
        method: "POST",
        body: JSON.stringify({ dayIndex, mealIndex, templateId }),
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Meal replaced from Library!" });
      if (data?.plan) queryClient.setQueryData(["weeklyPlan","current+meta"], data.plan);
      queryClient.invalidateQueries({ queryKey: ["weeklyPlan","current+meta"] });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Replace failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFridgeReplace = () => fridgeReplaceMutation.mutate();

  const handleCravingReplace = () => {
    if (!cravingText.trim()) {
      toast({ title: "Please enter what you're craving", variant: "destructive" });
      return;
    }
    cravingReplaceMutation.mutate();
  };

  const handleLibraryReplace = (template: any) => {
    libraryReplaceMutation.mutate(template.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Replace {currentMeal?.name || slotName(mealIndex)}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="fridge" className="h-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fridge" className="flex items-center gap-2">
              <ChefHat className="h-4 w-4" />
              Fridge Rescue
            </TabsTrigger>
            <TabsTrigger value="craving" className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Craving Creator
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              From Library
            </TabsTrigger>
          </TabsList>

          {/* FRIDGE TAB */}
          <TabsContent value="fridge" className="mt-6">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-2">🍳 Fridge Rescue</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Replace with a meal based on what you have on hand.
                </p>

                {/* Quick Replace (no navigation) */}
                <Button
                  onClick={handleFridgeReplace}
                  disabled={fridgeReplaceMutation.isPending}
                  className="w-full"
                >
                  {fridgeReplaceMutation.isPending ? "Finding replacement..." : "Replace now from Fridge"}
                </Button>

                {/* Open in Creator (navigate to page, then confirm back) */}
                <Button
                  variant="outline"
                  onClick={() => setLocation(fridgeRescueHref)}
                  className="w-full mt-2 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Fridge Rescue (customize)
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* CRAVING TAB */}
          <TabsContent value="craving" className="mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="craving">What are you craving?</Label>
                <Input
                  id="craving"
                  placeholder="e.g., Mexican, pasta, something spicy…"
                  value={cravingText}
                  onChange={(e) => setCravingText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCravingReplace()}
                />
              </div>

              {/* Quick Replace (no navigation) */}
              <Button
                onClick={handleCravingReplace}
                disabled={cravingReplaceMutation.isPending || !cravingText.trim()}
                className="w-full"
              >
                {cravingReplaceMutation.isPending ? "Finding replacement..." : "Replace now from Craving"}
              </Button>

              {/* Open in Creator (navigate to page, then confirm back) */}
              <Button
                variant="outline"
                onClick={() => setLocation(cravingCreatorHref)}
                className="w-full flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Craving Creator (customize)
              </Button>
            </div>
          </TabsContent>

          {/* LIBRARY TAB */}
          <TabsContent value="library" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search meal templates…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <ScrollArea className="h-96">
                {templatesLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading templates…</div>
                ) : (templates as any)?.items?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
                    {(templates as any).items.map((template: any) => (
                      <div
                        key={template.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleLibraryReplace(template)}
                      >
                        {template.imageUrl && (
                          <img
                            src={template.imageUrl}
                            alt={template.name}
                            className="w-full h-32 object-cover rounded mb-3"
                          />
                        )}
                        <h3 className="font-semibold text-sm mb-2">{template.name}</h3>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.badges?.slice(0, 3).map((badge: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {badge}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {template.calories} cal • {template.prepTime}m prep
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No templates found for this meal type
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}