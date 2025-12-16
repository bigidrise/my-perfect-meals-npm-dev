import type { Recipe } from "@shared/schema";

export interface UserMedicalProfile {
  medicalConditions: string[];
  foodAllergies: string[];
  dietaryRestrictions: string[];
  primaryGoal: string;
  activityLevel: string;
  customConditions: Record<string, string>;
}

// Service to generate meals based on medical conditions and health goals
export class MedicalPersonalizationService {
  
  // Generate personalized meals based on user's medical profile
  static generatePersonalizedMeal(
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    userProfile: UserMedicalProfile,
    dayNumber: number
  ): Recipe {
    
    // Base recipes that are safe for common medical conditions
    const medicallyPersonalizedRecipes = this.getMedicallyPersonalizedRecipes(userProfile);
    const filteredRecipes = medicallyPersonalizedRecipes[mealType];
    
    // Select appropriate recipe based on day and medical compatibility
    const selectedRecipe = filteredRecipes[dayNumber % filteredRecipes.length];
    
    // Enhance recipe with personalized nutritional adjustments
    return this.adjustRecipeForMedicalConditions(selectedRecipe, userProfile);
  }

  // Get recipes filtered for medical conditions
  private static getMedicallyPersonalizedRecipes(userProfile: UserMedicalProfile) {
    return {
      breakfast: [
        // Diabetes-friendly breakfast options
        {
          id: 'diabetes-friendly-eggs',
          name: 'Veggie Scrambled Eggs',
          description: 'Low-carb scrambled eggs with non-starchy vegetables',
          imageUrl: 'https://images.unsplash.com/photo-1525351326368-efbb5cb6814d?w=400&h=300&fit=crop',
          prepTime: 10,
          cookTime: 8,
          servings: 1,
          calories: 280,
          protein: 22,
          carbs: 6,
          fat: 20,
          fiber: 4,
          sugar: 3,
          sodium: 320,
          ingredients: [
            { name: 'Eggs', amount: '3', unit: 'large' },
            { name: 'Spinach', amount: '2', unit: 'cups' },
            { name: 'Bell Peppers', amount: '1/4', unit: 'cup' },
            { name: 'Olive Oil', amount: '1', unit: 'tsp' }
          ],
          instructions: [
            'Heat olive oil in non-stick pan',
            'Add vegetables and cook until tender',
            'Beat eggs and pour into pan',
            'Gently scramble until just set',
            'Season with herbs and serve'
          ],
          tags: ['low-carb', 'diabetes-friendly', 'high-protein'],
          mealType: 'breakfast',
          dietaryRestrictions: ['vegetarian'],
          createdAt: new Date()
        },
        // Heart-healthy breakfast
        {
          id: 'heart-healthy-oats',
          name: 'Steel-Cut Oats with Berries',
          description: 'Heart-healthy oats with antioxidant-rich berries',
          imageUrl: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=400&h=300&fit=crop',
          prepTime: 5,
          cookTime: 15,
          servings: 1,
          calories: 250,
          protein: 8,
          carbs: 42,
          fat: 4,
          fiber: 8,
          sugar: 12,
          sodium: 80,
          ingredients: [
            { name: 'Steel-cut Oats', amount: '1/3', unit: 'cup' },
            { name: 'Blueberries', amount: '1/2', unit: 'cup' },
            { name: 'Unsweetened Almond Milk', amount: '1', unit: 'cup' },
            { name: 'Cinnamon', amount: '1/4', unit: 'tsp' }
          ],
          instructions: [
            'Bring almond milk to boil',
            'Add oats, reduce heat to low',
            'Simmer 12-15 minutes, stirring occasionally',
            'Top with berries and cinnamon',
            'Serve warm'
          ],
          tags: ['heart-healthy', 'high-fiber', 'antioxidants'],
          mealType: 'breakfast',
          dietaryRestrictions: ['dairy-free', 'vegan'],
          createdAt: new Date()
        }
      ],
      lunch: [
        // Anti-inflammatory lunch
        {
          id: 'anti-inflammatory-salad',
          name: 'Mediterranean Salmon Salad',
          description: 'Omega-3 rich salmon with anti-inflammatory vegetables',
          imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop',
          prepTime: 15,
          cookTime: 10,
          servings: 1,
          calories: 420,
          protein: 35,
          carbs: 12,
          fat: 26,
          fiber: 6,
          sugar: 8,
          sodium: 380,
          ingredients: [
            { name: 'Wild Salmon Fillet', amount: '5', unit: 'oz' },
            { name: 'Mixed Greens', amount: '3', unit: 'cups' },
            { name: 'Cherry Tomatoes', amount: '1/2', unit: 'cup' },
            { name: 'Cucumber', amount: '1/2', unit: 'medium' },
            { name: 'Extra Virgin Olive Oil', amount: '2', unit: 'tbsp' }
          ],
          instructions: [
            'Season salmon with herbs and lemon',
            'Grill salmon for 4-5 minutes per side',
            'Prepare salad with mixed greens and vegetables',
            'Flake salmon over salad',
            'Drizzle with olive oil and serve'
          ],
          tags: ['anti-inflammatory', 'omega-3', 'heart-healthy'],
          mealType: 'lunch',
          dietaryRestrictions: ['gluten-free', 'dairy-free'],
          createdAt: new Date()
        }
      ],
      dinner: [
        // Low-sodium dinner option
        {
          id: 'low-sodium-chicken',
          name: 'Herb-Crusted Chicken with Sweet Potato',
          description: 'Low-sodium, heart-healthy dinner with potassium-rich vegetables',
          imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop',
          prepTime: 15,
          cookTime: 25,
          servings: 1,
          calories: 480,
          protein: 40,
          carbs: 35,
          fat: 18,
          fiber: 6,
          sugar: 8,
          sodium: 220,
          ingredients: [
            { name: 'Chicken Breast', amount: '6', unit: 'oz' },
            { name: 'Sweet Potato', amount: '1', unit: 'medium' },
            { name: 'Broccoli', amount: '1', unit: 'cup' },
            { name: 'Fresh Herbs', amount: '2', unit: 'tbsp' },
            { name: 'Olive Oil', amount: '1', unit: 'tbsp' }
          ],
          instructions: [
            'Preheat oven to 425°F',
            'Season chicken with herbs (no salt)',
            'Roast sweet potato and broccoli',
            'Bake chicken until internal temp reaches 165°F',
            'Serve with roasted vegetables'
          ],
          tags: ['low-sodium', 'heart-healthy', 'high-protein'],
          mealType: 'dinner',
          dietaryRestrictions: ['gluten-free', 'dairy-free'],
          createdAt: new Date()
        }
      ],
      snack: [
        {
          id: 'diabetic-friendly-nuts',
          name: 'Mixed Nuts with Dark Chocolate',
          description: 'Portion-controlled nuts with antioxidant-rich dark chocolate',
          imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop',
          prepTime: 2,
          cookTime: 0,
          servings: 1,
          calories: 160,
          protein: 6,
          carbs: 8,
          fat: 12,
          fiber: 3,
          sugar: 4,
          sodium: 40,
          ingredients: [
            { name: 'Mixed Raw Nuts', amount: '1', unit: 'oz' },
            { name: 'Dark Chocolate (85%)', amount: '1', unit: 'square' }
          ],
          instructions: [
            'Measure out 1 oz of mixed nuts',
            'Pair with 1 square of dark chocolate',
            'Enjoy slowly to promote satiety'
          ],
          tags: ['portion-controlled', 'antioxidants', 'healthy-fats'],
          mealType: 'snack',
          dietaryRestrictions: ['gluten-free', 'dairy-free'],
          createdAt: new Date()
        }
      ]
    };
  }

  // Adjust recipe based on specific medical conditions
  private static adjustRecipeForMedicalConditions(recipe: Recipe, userProfile: UserMedicalProfile): Recipe {
    let adjustedRecipe = { ...recipe };

    // Adjust for diabetes - reduce carbs and sugar if needed
    if (userProfile.medicalConditions.includes('diabetes_type1') || 
        userProfile.medicalConditions.includes('diabetes_type2')) {
      if ((adjustedRecipe.carbs || 0) > 45) {
        adjustedRecipe.carbs = Math.max(15, (adjustedRecipe.carbs || 45) - 15);
        adjustedRecipe.calories = (adjustedRecipe.calories || 0) - 60;
      }
      if ((adjustedRecipe.sugar || 0) > 12) {
        adjustedRecipe.sugar = Math.max(5, (adjustedRecipe.sugar || 12) - 5);
      }
    }

    // Adjust for hypertension - reduce sodium
    if (userProfile.medicalConditions.includes('hypertension')) {
      adjustedRecipe.sodium = Math.min(400, adjustedRecipe.sodium || 400);
    }

    // Adjust for weight loss goals
    if (userProfile.primaryGoal === 'weight_loss') {
      if ((adjustedRecipe.calories || 0) > 450) {
        const reductionFactor = 0.85;
        adjustedRecipe.calories = Math.round((adjustedRecipe.calories || 450) * reductionFactor);
        adjustedRecipe.carbs = Math.round((adjustedRecipe.carbs || 30) * reductionFactor);
        adjustedRecipe.fat = Math.round((adjustedRecipe.fat || 15) * reductionFactor);
      }
    }

    // Adjust for muscle gain goals
    if (userProfile.primaryGoal === 'muscle_gain') {
      adjustedRecipe.protein = (adjustedRecipe.protein || 20) + 5;
      adjustedRecipe.calories = (adjustedRecipe.calories || 400) + 50;
    }

    return adjustedRecipe;
  }

  // Generate a week's worth of meals based on user profile
  static generateWeeklyMealPlan(
    userProfile: UserMedicalProfile,
    mealsPerDay: number = 3,
    snacksPerDay: number = 1,
    duration: number = 7
  ): Array<{day: number, dayName: string, meals: Array<{type: string, recipe: Recipe}>}> {
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mealPlan = [];

    for (let day = 1; day <= duration; day++) {
      const dayName = days[(day - 1) % 7];
      const meals = [];

      // Generate main meals
      const mealTypes: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];
      const mealLabels = ['Breakfast', 'Lunch', 'Dinner'];
      
      for (let mealIndex = 0; mealIndex < mealsPerDay; mealIndex++) {
        const mealType = mealTypes[mealIndex] || 'dinner';
        const mealLabel = mealLabels[mealIndex] || 'Dinner';
        
        const recipe = this.generatePersonalizedMeal(mealType, userProfile, day + mealIndex);
        meals.push({ type: mealLabel, recipe });
      }

      // Generate snacks
      for (let snackIndex = 0; snackIndex < snacksPerDay; snackIndex++) {
        const snackLabels = ['Morning Snack', 'Afternoon Snack', 'Evening Snack', 'Night Snack'];
        const snackLabel = snackLabels[snackIndex] || 'Snack';
        
        const recipe = this.generatePersonalizedMeal('snack', userProfile, day + snackIndex);
        meals.push({ type: snackLabel, recipe });
      }

      mealPlan.push({ day, dayName, meals });
    }

    return mealPlan;
  }
}