import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ShoppingCart, Calendar } from "lucide-react";

type Product = {
  code: string;
  name: string;
  brand?: string | null;
  servingDesc?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  sugar?: number | null;
  basis?: "serving" | "100g";
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  defaultMealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
  userId: string;
  localDate: string; // "YYYY-MM-DD" in user's timezone
};

export default function ScanConfirmModal({ 
  open, 
  onClose, 
  product, 
  defaultMealSlot = "lunch", 
  userId, 
  localDate 
}: Props) {
  const [dest, setDest] = useState<"log" | "list">("log");
  const [mealSlot, setMealSlot] = useState<"breakfast" | "lunch" | "dinner" | "snack">(defaultMealSlot);
  const [servings, setServings] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const totals = useMemo(() => {
    const s = Number(servings) || 1;
    const c = Math.round((product?.calories ?? 0) * s);
    const p = Math.round((product?.protein ?? 0) * s);
    const cb = Math.round((product?.carbs ?? 0) * s);
    const f = Math.round((product?.fat ?? 0) * s);
    const fiber = Math.round((product?.fiber ?? 0) * s);
    const sodium = Math.round((product?.sodium ?? 0) * s);
    const sugar = Math.round((product?.sugar ?? 0) * s);
    return { c, p, cb, f, fiber, sodium, sugar };
  }, [product, servings]);

  async function handleConfirm() {
    if (!product || loading) return;
    setLoading(true);

    try {
      const { post } = await import("@/lib/api");
      
      if (dest === "log") {
        const body = {
          userId, 
          localDate, 
          mealSlot,
          barcode: product.code,
          servings,
        };
        await post("/api/meal-log", body);
        onClose();
      } else {
        const body = {
          userId,
          barcode: product.code,
          name: product.name,
          brand: product.brand ?? undefined,
          quantity: 1,
          unit: "pack",
        };
        await post("/api/shopping-list/items", body);
        onClose();
      }
    } catch (error: any) {
      console.error("Confirm error:", error);
      alert(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 text-black">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{product.name}</h3>
            {product.brand && (
              <p className="text-sm text-gray-600">{product.brand}</p>
            )}
            <p className="text-xs text-gray-500">{product.servingDesc || "per serving"}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nutrition Grid */}
        <div className="grid grid-cols-4 gap-3 text-center bg-gray-50 p-3 rounded-lg">
          <div>
            <div className="text-xs text-gray-500">Calories</div>
            <div className="font-semibold">{totals.c}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Protein</div>
            <div className="font-semibold">{totals.p}g</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Carbs</div>
            <div className="font-semibold">{totals.cb}g</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Fat</div>
            <div className="font-semibold">{totals.f}g</div>
          </div>
        </div>

        {/* Additional nutrition if available */}
        {(product.fiber || product.sodium || product.sugar) && (
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            {product.fiber && (
              <div>
                <div className="text-gray-500">Fiber</div>
                <div className="font-medium">{totals.fiber}g</div>
              </div>
            )}
            {product.sodium && (
              <div>
                <div className="text-gray-500">Sodium</div>
                <div className="font-medium">{totals.sodium}mg</div>
              </div>
            )}
            {product.sugar && (
              <div>
                <div className="text-gray-500">Sugar</div>
                <div className="font-medium">{totals.sugar}g</div>
              </div>
            )}
          </div>
        )}

        {/* Servings */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Servings:</label>
          <Input
            type="number"
            min="0.25"
            step="0.25"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 1)}
            className="w-24"
          />
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Add to:</label>
          <Select value={dest} onValueChange={(value: "log" | "list") => setDest(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="log">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Today's Meal Log
                </div>
              </SelectItem>
              <SelectItem value="list">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Shopping List
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Meal slot picker (only for meal log) */}
          {dest === "log" && (
            <Select value={mealSlot} onValueChange={(value: typeof mealSlot) => setMealSlot(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Adding..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}