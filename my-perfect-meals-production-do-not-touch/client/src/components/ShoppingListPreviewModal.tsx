import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

const AISLE_ORDER = ["Produce", "Meat", "Dairy", "Pantry", "Other"];

type PreviewItem = {
  name: string;
  quantity: string;
  unit?: string;
  category?: string;
};

type PreviewResponse = {
  items: Record<string, PreviewItem[]>;
  totalItems: number;
  newItems: number;
  updatedItems: number;
};

type MealData = {
  mealId: string;
  mealName: string;
  ingredients: Array<{ item: string; amount: string }>;
  generator?: string;
  day?: string;
  slot?: string;
};

type ShoppingListPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  meal: MealData | null;
};

export default function ShoppingListPreviewModal({ isOpen, onClose, meal }: ShoppingListPreviewModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (mealData: MealData) => {
      const response = await apiRequest('/api/shopping-list-v2/preview', {
        method: 'POST',
        body: JSON.stringify({ meals: [mealData] }),
      });
      
      // Transform array response to expected format
      if (Array.isArray(response)) {
        const items: Record<string, PreviewItem[]> = {};
        let totalItems = 0;
        
        response.forEach((item: any) => {
          const category = item.category || 'Other';
          if (!items[category]) {
            items[category] = [];
          }
          items[category].push({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
          });
          totalItems++;
        });
        
        return {
          items,
          totalItems,
          newItems: totalItems,
          updatedItems: 0,
        };
      }
      
      return response;
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
    onError: () => {
      toast({
        title: "Preview Failed",
        description: "Could not preview shopping list items. Please try again.",
        variant: "destructive",
      });
      onClose();
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (mealData: MealData) => {
      await apiRequest('/api/shopping-list-v2/commit', {
        method: 'POST',
        body: JSON.stringify({ meals: [mealData] }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Added to Shopping List!",
        description: `${meal?.mealName} ingredients added successfully.`,
      });
      onClose();
      setPreviewData(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add items to shopping list. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Load preview when modal opens with a meal
  useEffect(() => {
    if (isOpen && meal) {
      setPreviewData(null);
      previewMutation.mutate(meal);
    }
  }, [isOpen, meal]);

  const handleClose = () => {
    setPreviewData(null);
    onClose();
  };

  const handleConfirm = () => {
    if (meal) {
      commitMutation.mutate(meal);
    }
  };

  const handleViewList = () => {
    handleClose();
    setLocation('/shopping-list-v2');
  };

  const itemsByCategory = previewData?.items || {};
  const totalItems = previewData?.totalItems || 0;
  const newItems = previewData?.newItems || 0;
  const updatedItems = previewData?.updatedItems || 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-black/95 via-gray-900/95 to-black/95 border-white/20 text-white max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white/95 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-green-400" />
            Add to Shopping List
          </DialogTitle>
          {meal && (
            <div className="text-sm text-white/70">
              <span className="font-medium text-white/90">{meal.mealName}</span>
              {meal.generator && <span className="ml-2">({meal.generator})</span>}
              {meal.day && meal.slot && <span className="ml-2">• {meal.day} {meal.slot}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {previewMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-white/70 mb-4" />
              <p className="text-white/70">Loading preview...</p>
            </div>
          ) : previewData && totalItems > 0 ? (
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="text-sm text-white/90">
                  <div className="font-semibold mb-1">Summary:</div>
                  <div className="text-white/70">
                    • {totalItems} total items
                    {newItems > 0 && <span className="ml-3 text-green-400">+{newItems} new</span>}
                    {updatedItems > 0 && <span className="ml-3 text-blue-400">{updatedItems} updated</span>}
                  </div>
                </div>
              </div>

              {AISLE_ORDER.map(aisle => {
                const items = itemsByCategory[aisle];
                if (!items || items.length === 0) return null;

                return (
                  <div key={aisle}>
                    <h3 className="font-semibold text-white/90 mb-2 flex items-center gap-2">
                      <span>
                        {aisle === 'Produce' ? '🥬' : aisle === 'Meat' ? '🥩' : aisle === 'Dairy' ? '🥛' : aisle === 'Pantry' ? '🥫' : '📦'}
                      </span>
                      {aisle}
                      <span className="text-xs text-white/60 font-normal">({items.length})</span>
                    </h3>
                    <div className="space-y-1 ml-6">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="text-sm text-white/80 bg-white/5 px-3 py-1.5 rounded border border-white/10"
                        >
                          {item.name} — {item.quantity} {item.unit || ''}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-white/70">
              No items to preview
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            disabled={commitMutation.isPending}
            data-testid="button-cancel-preview"
          >
            Cancel
          </Button>
          
          {previewData && totalItems > 0 && (
            <>
              <Button
                variant="outline"
                onClick={handleViewList}
                className="bg-blue-500/20 border-blue-400/30 text-white hover:bg-blue-500/30"
                disabled={commitMutation.isPending}
                data-testid="button-view-list"
              >
                View List
              </Button>
              
              <Button
                onClick={handleConfirm}
                className="bg-green-500/20 border border-green-400/30 text-white hover:bg-green-500/30"
                disabled={commitMutation.isPending}
                data-testid="button-confirm-add"
              >
                {commitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to List
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
