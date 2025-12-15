import React, { useState, useRef, useEffect } from 'react';
import { apiUrl } from '@/lib/resolveApiBase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import PreparationModal, { normalizeIngredientName } from '@/components/PreparationModal';
import { SNACK_CATEGORIES } from '@/data/snackIngredients';
import { DIABETIC_SNACK_CATEGORIES } from '@/data/diabeticPremadeSnacks';
import { GLP1_SNACK_CATEGORIES } from '@/data/glp1Snacks';
import antiInflammatorySnacks from '@/data/antiInflammatory.snacks';
import { competitionSnackOptions } from '@/data/competitionSnacks';
import { getStaticSnackImage } from '../../../../shared/staticSnackMappings';

interface SnackPickerDrawerProps {
  open: boolean;
  onClose: () => void;
  onSnackSelect?: (snack: any) => void;
  dietType?: 'normal' | 'diabetic' | 'glp1' | 'anti-inflammatory' | 'competition';
}

// Build snack data based on diet type
function getSnackDataByDiet(dietType: string) {
  if (dietType === 'diabetic') {
    // Diabetic snacks - isolated from GLP-1
    return {
      [DIABETIC_SNACK_CATEGORIES[0].name]: DIABETIC_SNACK_CATEGORIES[0].items.map((item, idx) => ({
        id: `diabetic-snack-${DIABETIC_SNACK_CATEGORIES[0].name}-${idx}`,
        name: item
      })),
      [DIABETIC_SNACK_CATEGORIES[1].name]: DIABETIC_SNACK_CATEGORIES[1].items.map((item, idx) => ({
        id: `diabetic-snack-${DIABETIC_SNACK_CATEGORIES[1].name}-${idx}`,
        name: item
      })),
      [DIABETIC_SNACK_CATEGORIES[2].name]: DIABETIC_SNACK_CATEGORIES[2].items.map((item, idx) => ({
        id: `diabetic-snack-${DIABETIC_SNACK_CATEGORIES[2].name}-${idx}`,
        name: item
      })),
      [DIABETIC_SNACK_CATEGORIES[3].name]: DIABETIC_SNACK_CATEGORIES[3].items.map((item, idx) => ({
        id: `diabetic-snack-${DIABETIC_SNACK_CATEGORIES[3].name}-${idx}`,
        name: item
      })),
      [DIABETIC_SNACK_CATEGORIES[4].name]: DIABETIC_SNACK_CATEGORIES[4].items.map((item, idx) => ({
        id: `diabetic-snack-${DIABETIC_SNACK_CATEGORIES[4].name}-${idx}`,
        name: item
      })),
      [DIABETIC_SNACK_CATEGORIES[5].name]: DIABETIC_SNACK_CATEGORIES[5].items.map((item, idx) => ({
        id: `diabetic-snack-${DIABETIC_SNACK_CATEGORIES[5].name}-${idx}`,
        name: item
      }))
    };
  } else if (dietType === 'glp1') {
    // GLP-1 snacks - completely separate from diabetic
    return {
      [GLP1_SNACK_CATEGORIES[0].name]: GLP1_SNACK_CATEGORIES[0].items.map((item, idx) => ({
        id: `glp1-snack-${GLP1_SNACK_CATEGORIES[0].name}-${idx}`,
        name: item
      })),
      [GLP1_SNACK_CATEGORIES[1].name]: GLP1_SNACK_CATEGORIES[1].items.map((item, idx) => ({
        id: `glp1-snack-${GLP1_SNACK_CATEGORIES[1].name}-${idx}`,
        name: item
      })),
      [GLP1_SNACK_CATEGORIES[2].name]: GLP1_SNACK_CATEGORIES[2].items.map((item, idx) => ({
        id: `glp1-snack-${GLP1_SNACK_CATEGORIES[2].name}-${idx}`,
        name: item
      })),
      [GLP1_SNACK_CATEGORIES[3].name]: GLP1_SNACK_CATEGORIES[3].items.map((item, idx) => ({
        id: `glp1-snack-${GLP1_SNACK_CATEGORIES[3].name}-${idx}`,
        name: item
      })),
      [GLP1_SNACK_CATEGORIES[4].name]: GLP1_SNACK_CATEGORIES[4].items.map((item, idx) => ({
        id: `glp1-snack-${GLP1_SNACK_CATEGORIES[4].name}-${idx}`,
        name: item
      })),
      [GLP1_SNACK_CATEGORIES[5].name]: GLP1_SNACK_CATEGORIES[5].items.map((item, idx) => ({
        id: `glp1-snack-${GLP1_SNACK_CATEGORIES[5].name}-${idx}`,
        name: item
      }))
    };
  } else if (dietType === 'anti-inflammatory') {
    // Anti-inflammatory snacks
    return {
      'Sweet': antiInflammatorySnacks.Sweet.map((item, idx) => ({
        id: `anti-inflammatory-snack-sweet-${idx}`,
        name: item
      })),
      'Savory': antiInflammatorySnacks.Savory.map((item, idx) => ({
        id: `anti-inflammatory-snack-savory-${idx}`,
        name: item
      })),
      'Crunchy': antiInflammatorySnacks.Crunchy.map((item, idx) => ({
        id: `anti-inflammatory-snack-crunchy-${idx}`,
        name: item
      })),
      'Creamy': antiInflammatorySnacks.Creamy.map((item, idx) => ({
        id: `anti-inflammatory-snack-creamy-${idx}`,
        name: item
      })),
      'High Protein': antiInflammatorySnacks.HighProtein.map((item, idx) => ({
        id: `anti-inflammatory-snack-protein-${idx}`,
        name: item
      }))
    };
  } else if (dietType === 'competition') {
    // Competition prep snacks - ONE CATEGORY ONLY
    // 20 prep-safe snacks: low sugar, clean fats, high protein
    return {
      'Contest Prep Snacks': competitionSnackOptions.map((snack) => ({
        id: snack.id,
        name: snack.title
      }))
    };
  } else {
    // Normal snacks (default)
    return {
      [SNACK_CATEGORIES[0].name]: SNACK_CATEGORIES[0].items.map((item, idx) => ({
        id: `normal-snack-${SNACK_CATEGORIES[0].name}-${idx}`,
        name: item
      })),
      [SNACK_CATEGORIES[1].name]: SNACK_CATEGORIES[1].items.map((item, idx) => ({
        id: `normal-snack-${SNACK_CATEGORIES[1].name}-${idx}`,
        name: item
      })),
      [SNACK_CATEGORIES[2].name]: SNACK_CATEGORIES[2].items.map((item, idx) => ({
        id: `normal-snack-${SNACK_CATEGORIES[2].name}-${idx}`,
        name: item
      })),
      [SNACK_CATEGORIES[3].name]: SNACK_CATEGORIES[3].items.map((item, idx) => ({
        id: `normal-snack-${SNACK_CATEGORIES[3].name}-${idx}`,
        name: item
      })),
      [SNACK_CATEGORIES[4].name]: SNACK_CATEGORIES[4].items.map((item, idx) => ({
        id: `normal-snack-${SNACK_CATEGORIES[4].name}-${idx}`,
        name: item
      }))
    };
  }
}

export default function SnackPickerDrawer({
  open,
  onClose,
  onSnackSelect,
  dietType = 'normal'
}: SnackPickerDrawerProps) {
  const snackData = getSnackDataByDiet(dietType);
  
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [currentIngredient, setCurrentIngredient] = useState('');
  const [pendingSnack, setPendingSnack] = useState<any>(null);
  const [pendingCategory, setPendingCategory] = useState<string>('');
  const [cookingStyles, setCookingStyles] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const tickerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) {
          const next = p + Math.max(1, Math.floor((90 - p) * 0.07));
          return Math.min(next, 90);
        }
        return p;
      });
    }, 150);
  };

  // Shared cleanup routine for all cancellation paths
  const cleanupGeneration = () => {
    // Abort ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Stop and reset progress ticker
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    
    // Reset all state
    setGenerating(false);
    setProgress(0);
    setPendingSnack(null);
    setPendingCategory('');
    setCookingStyles({});
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupGeneration();
    };
  }, []);

  // List of ingredients that need cooking style selection
  const NEEDS_PREP = [
    // Eggs
    'Eggs', 'Egg Whites', 'Whole Eggs',
    
    // Steaks
    'Steak', 'Ribeye', 'Ribeye Steak', 'Sirloin Steak', 'Top Sirloin', 'Filet Mignon',
    'New York Strip', 'NY Strip', 'Strip Steak', 'Porterhouse', 'Porterhouse Steak',
    'T-Bone', 'T-Bone Steak', 'TBone Steak', 'Skirt Steak', 'Flank Steak',
    'Flat Iron Steak', 'Tri-Tip', 'Tri-Tip Steak', 'Hanger Steak',
    'Kobe Steak', 'Kobe Beef', 'Wagyu Steak', 'Wagyu Beef',
    
    // Chicken (base + variations)
    'Chicken', 'Chicken Breast', 'Chicken Thighs', 'Chicken Sausage', 'Ground Chicken',
    
    // Turkey (base + variations)
    'Turkey', 'Turkey Breast', 'Ground Turkey', 'Turkey Sausage',
    
    // Fish
    'Salmon', 'Tilapia', 'Cod', 'Tuna', 'Tuna Steak', 'Halibut', 'Mahi Mahi',
    'Trout', 'Sardines', 'Anchovies', 'Catfish', 'Sea Bass', 'Red Snapper',
    'Flounder', 'Orange Roughy', 'Sole',
    
    // Potatoes (ALL PLURAL)
    'Potatoes', 'Red Potatoes', 'Sweet Potatoes', 'Yams',
    
    // Rice
    'Rice', 'White Rice', 'Brown Rice', 'Jasmine Rice', 'Basmati Rice', 'Wild Rice',
    
    // Vegetables
    'Broccoli', 'Asparagus', 'Green Beans', 'Mixed Vegetables',
    'Cauliflower', 'Brussels Sprouts', 'Kale', 'Spinach',
    'Carrots', 'Celery', 'Cucumber',
    
    // Salads
    'Lettuce', 'Romaine Lettuce', 'Spring Mix'
  ];

  // Set initial category when modal opens
  React.useEffect(() => {
    if (open) {
      const firstCategory = Object.keys(snackData)[0];
      if (firstCategory) {
        setActiveCategory(firstCategory);
      }
    }
  }, [open, dietType]);

  const handleSelectSnack = (snack: any, category: string) => {
    // Check snack name for items that need prep selection
    const snackNameLower = snack.name.toLowerCase();
    const needsPrepIngredient = NEEDS_PREP.find(ing => {
      const normalizedPrep = normalizeIngredientName(ing);
      return snackNameLower.includes(normalizedPrep.toLowerCase());
    });

    if (needsPrepIngredient) {
      // Show prep modal first
      setPendingSnack(snack);
      setPendingCategory(category);
      setCurrentIngredient(needsPrepIngredient);
      setPrepModalOpen(true);
    } else {
      // No prep needed, generate immediately
      generateSnackMeal(snack, category, {});
    }
  };

  const handlePrepSelect = (ingredient: string, style: string) => {
    const updatedStyles = { ...cookingStyles, [ingredient]: style };
    setCookingStyles(updatedStyles);
    
    // Generate snack with selected style
    if (pendingSnack) {
      generateSnackMeal(pendingSnack, pendingCategory, updatedStyles);
      setPendingSnack(null);
      setPendingCategory('');
    }
  };

  const generateSnackMeal = async (snack: any, category: string, styles: Record<string, string>) => {
    setGenerating(true);
    startProgressTicker();
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    try {
      // Build ingredient list (simple snack name)
      const ingredientsList = [snack.name];
      
      console.log(`🎨 Generating snack with ingredients:`, ingredientsList);
      
      // Use the SAME unified endpoint as AI Meal Creator and Premades - routes through Fridge Rescue
      const response = await fetch(apiUrl('/api/meals/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fridge-rescue',
          mealType: 'snack',
          input: ingredientsList,
          userId: '1',
          count: 1
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate snack');
      }
      
      const data = await response.json();
      
      // Unified pipeline returns { success, meals, source } - use meals[0] like Fridge Rescue
      if (!data.success || !data.meals?.[0]) {
        throw new Error(data.error || 'No snack found in response');
      }
      
      const generatedSnack = data.meals[0];
      
      // 🎨 Use server-generated image (DALL-E or static depending on server logic)
      // Fridge Rescue returns DALL-E images for custom meals
      // Pre-made snacks use static images (already determined server-side)
      const finalImageUrl = generatedSnack.imageUrl || getStaticSnackImage(snack.name);
      console.log(`🎨 Snack image: "${generatedSnack.name || snack.name}" → ${finalImageUrl}`);
      
      // Transform to match board format with stable ID
      const stableId = `snack-${snack.id}-${(snack.name || '').replace(/\s+/g, '_').slice(0, 20)}`;
      const snackMeal = {
        id: stableId,
        title: generatedSnack.name || snack.name,
        name: generatedSnack.name || snack.name,
        description: generatedSnack.description,
        servings: 1,
        ingredients: generatedSnack.ingredients || [],
        instructions: generatedSnack.instructions || [],
        imageUrl: finalImageUrl,
        nutrition: generatedSnack.nutrition || {
          calories: generatedSnack.calories || 150,
          protein: generatedSnack.protein || 10,
          carbs: generatedSnack.carbs || 15,
          fat: generatedSnack.fat || 8
        },
        medicalBadges: generatedSnack.medicalBadges || [],
        source: 'snack-picker',
        category: category
      };
      
      console.log(`✅ Snack created with image:`, snackMeal.imageUrl);
      
      // Call the parent's onSnackSelect handler
      if (onSnackSelect) {
        onSnackSelect(snackMeal);
      }
      
      toast({
        title: 'Snack Added!',
        description: `${snack.name} has been added to your snacks`,
      });
      
      // Clean up and close on success
      cleanupGeneration();
      onClose();
    } catch (error: any) {
      // Don't show error if request was cancelled
      if (error.name === 'AbortError') {
        console.log('Snack generation cancelled by user');
        return;
      }
      
      console.error('Error generating snack:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate snack. Please try again.',
        variant: 'destructive'
      });
      
      // Clean up on error
      cleanupGeneration();
    }
  };

  const handleCancel = () => {
    // Use shared cleanup routine
    cleanupGeneration();
    
    // Close modal
    onClose();
  };

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Cancel generation if modal is being closed
      cleanupGeneration();
      onClose();
    }
  };

  const categories = Object.keys(snackData);
  const allSnacks = (snackData[activeCategory as keyof typeof snackData] || []) as any[];
  
  // Filter snacks by search query
  const currentSnacks = searchQuery.trim()
    ? allSnacks.filter(snack => 
        snack.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSnacks;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-gradient-to-br from-zinc-900 via-zinc-800 to-black border border-white/20 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">
            Snack Creator
          </DialogTitle>
        </DialogHeader>

        {/* Category Tabs - Purple Style (Matching AI Premades) */}
        <div className="flex flex-nowrap gap-2 mb-3 overflow-x-auto w-full min-w-0 pb-2 overscroll-x-contain touch-pan-x">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === category
                  ? 'bg-purple-600/40 border-2 border-purple-400 text-white shadow-md'
                  : 'bg-black/40 border border-white/20 text-white/70 hover:bg-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="mb-3">
          <Input
            placeholder="Search snacks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/40 text-white border-white/20 placeholder:text-white/50"
          />
        </div>

        {/* Snack Grid - Checkbox Style (Two Column Layout) */}
        <div className="overflow-y-auto max-h-[50vh] mb-3 min-h-0">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {currentSnacks.map((snack: any) => (
              <div
                key={snack.id}
                onClick={() => handleSelectSnack(snack, activeCategory)}
                className="flex flex-col items-center gap-0.5 text-white/90 hover:text-white group p-1 min-h-[44px] cursor-pointer"
              >
                <Checkbox
                  checked={false}
                  className="h-1.5 w-1.5 border-white/30 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-500 pointer-events-none"
                />
                <span className="text-[11px] group-hover:text-emerald-300 transition-colors text-center">
                  {snack.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cancel Button */}
        <div className="flex justify-end gap-3 mb-3">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="bg-black/40 border-white/20 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
        </div>

        {generating && (
          <div className="w-full mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/80">AI Analysis Progress</span>
              <span className="text-sm text-white/80">{Math.round(progress)}%</span>
            </div>
            <Progress
              value={progress}
              className="h-3 bg-black/30 border border-white/20"
            />
          </div>
        )}
      </DialogContent>

      {/* Preparation Style Modal */}
      <PreparationModal
        open={prepModalOpen}
        ingredientName={currentIngredient}
        onClose={() => setPrepModalOpen(false)}
        onSelect={handlePrepSelect}
      />
    </Dialog>
  );
}
