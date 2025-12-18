import { useState } from 'react';
import { apiUrl } from '@/lib/resolveApiBase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Sparkles, Save, Check } from 'lucide-react';

interface CreateRecipeFormProps {
  onBack: () => void;
}

export default function CreateRecipeForm({ onBack }: CreateRecipeFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [recipe, setRecipe] = useState({
    title: '',
    ingredients: '',
    instructions: '',
    tips: '',
    videoUrl: ''
  });

  const handleChange = (field: string, value: string) => {
    setRecipe(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl('/api/user-recipes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...recipe,
          ingredients: recipe.ingredients.split('\n').filter(i => i.trim()),
          instructions: recipe.instructions.split('\n').filter(i => i.trim())
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit recipe');
      }

      const data = await response.json();
      setJustSubmitted(true);
      toast({
        title: "Recipe Submitted!",
        description: "Your recipe has been submitted for review. Thank you for sharing!",
      });

      // Reset success state after 3 seconds
      setTimeout(() => {
        setJustSubmitted(false);
      }, 3000);

      // Reset form
      setRecipe({
        title: '',
        ingredients: '',
        instructions: '',
        tips: '',
        videoUrl: ''
      });
      setAiFeedback('');
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit recipe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAIFeedback = async () => {
    if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
      toast({
        title: "Missing Information",
        description: "Please fill in title, ingredients, and instructions before getting AI feedback.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingFeedback(true);

    try {
      const response = await fetch(apiUrl('/api/get-recipe-feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe: {
            ...recipe,
            ingredients: recipe.ingredients.split('\n').filter(i => i.trim()),
            instructions: recipe.instructions.split('\n').filter(i => i.trim())
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI feedback');
      }

      const data = await response.json();
      setAiFeedback(data.feedback);
      toast({
        title: "AI Feedback Generated!",
        description: "Review the AI feedback below to improve your recipe.",
      });
    } catch (error: any) {
      toast({
        title: "Feedback Failed",
        description: error.message || "Failed to generate AI feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGettingFeedback(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tutorials
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Create Your Recipe
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Share your cooking creation with the community
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recipe Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recipe Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recipe Title *
                  </label>
                  <Input
                    placeholder="e.g., Grandma's Chocolate Chip Cookies"
                    value={recipe.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ingredients * <span className="text-gray-500">(one per line)</span>
                  </label>
                  <Textarea
                    placeholder={`2 cups all-purpose flour\n1 cup brown sugar\n1/2 cup butter, softened\n2 large eggs\n1 tsp vanilla extract\n1 cup chocolate chips`}
                    value={recipe.ingredients}
                    onChange={(e) => handleChange('ingredients', e.target.value)}
                    rows={8}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Instructions * <span className="text-gray-500">(one step per line)</span>
                  </label>
                  <Textarea
                    placeholder={`Preheat oven to 375°F (190°C)\nIn a large bowl, cream together butter and brown sugar\nBeat in eggs one at a time, then stir in vanilla\nGradually blend in flour\nFold in chocolate chips\nDrop rounded tablespoons onto ungreased cookie sheets\nBake for 9-11 minutes until golden brown`}
                    value={recipe.instructions}
                    onChange={(e) => handleChange('instructions', e.target.value)}
                    rows={10}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pro Tips <span className="text-gray-500">(optional)</span>
                  </label>
                  <Textarea
                    placeholder="Any special tips or tricks that make this recipe extra special..."
                    value={recipe.tips}
                    onChange={(e) => handleChange('tips', e.target.value)}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Video URL <span className="text-gray-500">(optional)</span>
                  </label>
                  <Input
                    placeholder="https://youtube.com/watch?v=..."
                    value={recipe.videoUrl}
                    onChange={(e) => handleChange('videoUrl', e.target.value)}
                    type="url"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getAIFeedback}
                    disabled={isGettingFeedback}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGettingFeedback ? 'Getting Feedback...' : 'Get AI Feedback'}
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={isSubmitting || justSubmitted}
                    className={`flex items-center gap-2 ${
                      justSubmitted 
                        ? "bg-green-500 hover:bg-green-600" 
                        : ""
                    } transition-all duration-200`}
                  >
                    {justSubmitted ? (
                      <><Check className="w-4 h-4" />Recipe Submitted ✓</>
                    ) : isSubmitting ? (
                      <><Save className="w-4 h-4" />Submitting...</>
                    ) : (
                      <><Save className="w-4 h-4" />Submit Recipe</>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Submission Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Submission Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-green-600">✓</span>
                  <span>Use clear, specific measurements</span>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-green-600">✓</span>
                  <span>Include cooking temperatures and times</span>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-green-600">✓</span>
                  <span>Write step-by-step instructions</span>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-green-600">✓</span>
                  <span>Share personal tips and variations</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Feedback */}
          {aiFeedback && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  AI Chef Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {aiFeedback}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}