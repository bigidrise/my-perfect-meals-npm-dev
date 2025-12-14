import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Check, Clock } from "lucide-react";

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
  // Mock data for demonstration
  const groceryItems: GroceryItem[] = items || [
    { id: "1", name: "Organic Chicken Breast", completed: false, category: "Protein" },
    { id: "2", name: "Brown Rice", completed: true, category: "Grains" },
    { id: "3", name: "Fresh Spinach", completed: false, category: "Vegetables" },
    { id: "4", name: "Greek Yogurt", completed: true, category: "Dairy" },
    { id: "5", name: "Salmon Fillet", completed: false, category: "Protein" },
  ];

  const completedItems = groceryItems.filter(item => item.completed).length;
  const totalItems = groceryItems.length;
  const completionPercentage = Math.round((completedItems / totalItems) * 100);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-500" />
          Weekly Grocery List
        </CardTitle>
        <CardDescription>
          Your personalized shopping list based on meal plans
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div>
            <div className="font-semibold text-blue-800 dark:text-blue-200">
              {completedItems} of {totalItems} items completed
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-300">
              {completionPercentage}% of your shopping done
            </div>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Updated today
          </Badge>
        </div>

        {/* Recent Items */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
            Recent Items
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

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Plus className="w-4 h-4 mr-1" />
            Add Item
          </Button>
          <Button size="sm" className="flex-1">
            View Full List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GroceryDashboardCard;