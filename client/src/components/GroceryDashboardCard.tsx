import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Check, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GroceryItem {
  id: string;
  name: string;
  completed: boolean;
  category: string;
}

interface GroceryDashboardCardProps {
  items?: GroceryItem[];
}

const GroceryDashboardCard = ({ items }: GroceryDashboardCardProps) => {
  const { t } = useTranslation("groceryDashCard");
  const groceryItems: GroceryItem[] = items || [];

  const completedItems = groceryItems.filter(item => item.completed).length;
  const totalItems = groceryItems.length;
  const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-500" />
          {t("title")}
        </CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalItems === 0 ? (
          /* Localized empty state — no hardcoded English */
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            {t("noItems")}
          </p>
        ) : (
          <>
            {/* Progress Overview */}
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div>
                <div className="font-semibold text-blue-800 dark:text-blue-200">
                  {t("itemsCompleted", { completed: completedItems, total: totalItems })}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-300">
                  {t("shoppingDone", { pct: completionPercentage })}
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <Clock className="w-3 h-3 mr-1" />
                {t("updatedToday")}
              </Badge>
            </div>

            {/* Recent Items */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                {t("recentItems")}
              </h4>
              <div className="space-y-2">
                {groceryItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      item.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {item.completed && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm ${
                        item.completed
                          ? 'line-through text-gray-500'
                          : 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500">{item.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Actions — always visible */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Plus className="w-4 h-4 mr-1" />
            {t("addItem")}
          </Button>
          <Button size="sm" className="flex-1">
            {t("viewFullList")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GroceryDashboardCard;
