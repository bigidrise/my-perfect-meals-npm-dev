import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wine, Beer, Coffee, Martini, Sparkles, Heart, Shield } from "lucide-react";

interface AlcoholRecommendation {
  name: string;
  type: string;
  description: string;
  alcoholContent?: string;
  calories?: number;
  sugar?: string;
  ingredients?: string[];
  instructions?: string[];
  pairingReason?: string;
  healthNotes?: string[];
  medicalCompatibility?: {
    diabeticFriendly: boolean;
    lowCalorie: boolean;
    reason: string;
  };
  imageUrl?: string;
}

interface AlcoholRecommendationCardProps {
  recommendation: AlcoholRecommendation;
  className?: string;
}

const getCategoryIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('wine')) return <Wine className="h-5 w-5" />;
  if (lowerType.includes('beer')) return <Beer className="h-5 w-5" />;
  if (lowerType.includes('mocktail') || lowerType.includes('mixer')) return <Martini className="h-5 w-5" />;
  if (lowerType.includes('tea') || lowerType.includes('alternative')) return <Coffee className="h-5 w-5" />;
  return <Sparkles className="h-5 w-5" />;
};

export default function AlcoholRecommendationCard({ 
  recommendation, 
  className = "" 
}: AlcoholRecommendationCardProps) {
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getCategoryIcon(recommendation.type)}
            {recommendation.name}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {recommendation.type}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Image */}
        {recommendation.imageUrl && (
          <div className="w-full h-48 rounded-lg overflow-hidden">
            <img 
              src={recommendation.imageUrl} 
              alt={recommendation.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Description */}
        <p className="text-gray-600">{recommendation.description}</p>

        {/* Key Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {recommendation.alcoholContent && (
            <div>
              <span className="font-medium">Alcohol:</span> {recommendation.alcoholContent}
            </div>
          )}
          {recommendation.calories && (
            <div>
              <span className="font-medium">Calories:</span> {recommendation.calories}
            </div>
          )}
          {recommendation.sugar && (
            <div className="col-span-2">
              <span className="font-medium">Sugar:</span> {recommendation.sugar}
            </div>
          )}
        </div>

        {/* Medical Compatibility */}
        {recommendation.medicalCompatibility && (
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Health Profile</span>
            </div>
            <div className="flex gap-2 mb-2">
              {recommendation.medicalCompatibility.diabeticFriendly && (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  <Heart className="h-3 w-3 mr-1" />
                  Diabetic Friendly
                </Badge>
              )}
              {recommendation.medicalCompatibility.lowCalorie && (
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  Low Calorie
                </Badge>
              )}
            </div>
            <p className="text-sm text-green-700">
              {recommendation.medicalCompatibility.reason}
            </p>
          </div>
        )}

        {/* Ingredients */}
        {recommendation.ingredients && recommendation.ingredients.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Ingredients:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {recommendation.ingredients.map((ingredient, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  {ingredient}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {recommendation.instructions && recommendation.instructions.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Instructions:</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              {recommendation.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-2">
                  <span className="font-medium text-gray-400">{index + 1}.</span>
                  {instruction}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Pairing Reason */}
        {recommendation.pairingReason && (
          <div className="bg-purple-50 p-3 rounded-lg">
            <h4 className="font-medium text-purple-800 mb-1">Perfect Pairing</h4>
            <p className="text-sm text-purple-700">{recommendation.pairingReason}</p>
          </div>
        )}

        {/* Health Notes */}
        {recommendation.healthNotes && recommendation.healthNotes.length > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Health Benefits</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              {recommendation.healthNotes.map((note, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Heart className="h-3 w-3 text-blue-600" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}