import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Clock, ChefHat, Lightbulb, CheckCircle2 } from 'lucide-react';
import { CookingTutorial } from '../../../shared/cookingTutorials';

interface TutorialViewerProps {
  tutorial: CookingTutorial;
  onBack: () => void;
}

export default function TutorialViewer({ tutorial, onBack }: TutorialViewerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleStepComplete = (stepIndex: number) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepIndex);
    setCompletedSteps(newCompleted);
    
    if (stepIndex < tutorial.instructions.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };

  const nextStep = () => {
    if (currentStep < tutorial.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const currentInstruction = tutorial.instructions[currentStep];
  const progressPercentage = ((currentStep + 1) / tutorial.instructions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Tutorials
        </Button>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Step {currentStep + 1} of {tutorial.instructions.length}
        </div>
      </div>

      {/* Tutorial Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {tutorial.title}
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {tutorial.description}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-4">
            <Badge className={getDifficultyColor(tutorial.difficulty)}>
              {tutorial.difficulty}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {tutorial.cookingTime} minutes
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <ChefHat className="w-3 h-3" />
              {tutorial.skillsLearned.length} skills
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Step */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Step {currentInstruction.step}</span>
                {completedSteps.has(currentStep) && (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg leading-relaxed text-gray-900 dark:text-gray-100">
                {currentInstruction.description}
              </p>

              {/* Tips */}
              {currentInstruction.tips && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">Pro Tip</p>
                      <p className="text-blue-800 dark:text-blue-200 text-sm">
                        {currentInstruction.tips}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </Button>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStepComplete(currentStep)}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Complete
                  </Button>
                  
                  <Button
                    onClick={nextStep}
                    disabled={currentStep === tutorial.instructions.length - 1}
                    className="flex items-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ingredients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ingredients</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {tutorial.ingredients.map((ingredient, index) => (
                  <li key={index} className="text-sm">
                    <span className="font-medium">{ingredient.quantity} {ingredient.name}</span>
                    {ingredient.notes && (
                      <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                        {ingredient.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Skills Learning */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Skills You'll Learn</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {tutorial.skillsLearned.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill.replace('-', ' ')}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* General Tips */}
          {tutorial.tips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">General Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {tutorial.tips.map((tip, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <Lightbulb className="w-3 h-3 text-yellow-500 mt-1 flex-shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Nutrition Info */}
          {tutorial.nutritionInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nutrition</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-lg">{tutorial.nutritionInfo.calories}</div>
                    <div className="text-gray-600 dark:text-gray-400">Calories</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg">{tutorial.nutritionInfo.protein}g</div>
                    <div className="text-gray-600 dark:text-gray-400">Protein</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg">{tutorial.nutritionInfo.carbs}g</div>
                    <div className="text-gray-600 dark:text-gray-400">Carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg">{tutorial.nutritionInfo.fat}g</div>
                    <div className="text-gray-600 dark:text-gray-400">Fat</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}