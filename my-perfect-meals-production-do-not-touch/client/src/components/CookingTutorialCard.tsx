import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, ChefHat, Play } from 'lucide-react';
import { CookingTutorial } from '../../../shared/cookingTutorials';

interface CookingTutorialCardProps {
  tutorial: CookingTutorial;
  onStartTutorial: (tutorial: CookingTutorial) => void;
}

export default function CookingTutorialCard({ tutorial, onStartTutorial }: CookingTutorialCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'knife-skills': return '🔪';
      case 'sauteing': return '🍳';
      case 'baking': return '🍞';
      case 'grilling': return '🔥';
      case 'desserts': return '🍰';
      default: return '👨‍🍳';
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {getCategoryIcon(tutorial.category)} {tutorial.title}
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {tutorial.description}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge className={getDifficultyColor(tutorial.difficulty)}>
            {tutorial.difficulty}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {tutorial.cookingTime}min
          </Badge>
          <Badge variant="outline" className="text-xs">
            <ChefHat className="w-3 h-3 mr-1" />
            {tutorial.skillsLearned.length} skills
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Skills Preview */}
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Skills You'll Learn:</p>
            <div className="flex flex-wrap gap-1">
              {tutorial.skillsLearned.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill.replace('-', ' ')}
                </Badge>
              ))}
              {tutorial.skillsLearned.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{tutorial.skillsLearned.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          {/* Nutrition Preview */}
          {tutorial.nutritionInfo && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">{tutorial.nutritionInfo.calories} cal</span>
              {' • '}
              <span>{tutorial.nutritionInfo.protein}g protein</span>
            </div>
          )}

          {/* Action Button */}
          <Button 
            onClick={() => onStartTutorial(tutorial)}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Tutorial
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}