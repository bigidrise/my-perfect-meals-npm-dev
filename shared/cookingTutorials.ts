// Comprehensive Learn to Cook Tutorial System
export interface CookingTutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  cookingTime: number; // minutes
  category: 'basics' | 'knife-skills' | 'sauteing' | 'baking' | 'grilling' | 'desserts';
  ingredients: Array<{
    name: string;
    quantity: string;
    notes?: string;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    imageUrl?: string;
    videoUrl?: string;
    tips?: string;
  }>;
  tips: string[];
  videoUrl?: string;
  imageUrl: string;
  skillsLearned: string[];
  nutritionInfo?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface CookingSkill {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'knife' | 'heat' | 'technique' | 'baking' | 'seasoning';
  videoUrl?: string;
  relatedTutorials: string[]; // tutorial IDs
}

// Sample cooking tutorials data
export const cookingTutorials: CookingTutorial[] = [
  {
    id: 'perfect-scrambled-eggs',
    title: 'Perfect Scrambled Eggs',
    description: 'Learn the technique for creamy, restaurant-quality scrambled eggs',
    difficulty: 'beginner',
    cookingTime: 10,
    category: 'basics',
    ingredients: [
      { name: 'Large eggs', quantity: '3', notes: 'Room temperature works best' },
      { name: 'Butter', quantity: '2 tbsp', notes: 'Unsalted' },
      { name: 'Heavy cream', quantity: '2 tbsp', notes: 'Optional for extra creaminess' },
      { name: 'Salt', quantity: '1/4 tsp' },
      { name: 'Fresh chives', quantity: '1 tbsp', notes: 'Chopped, for garnish' }
    ],
    instructions: [
      {
        step: 1,
        description: 'Crack eggs into a bowl and whisk until completely combined. Add cream and salt.',
        tips: 'Whisking until smooth ensures even cooking'
      },
      {
        step: 2,
        description: 'Heat a non-stick pan over low-medium heat. Add half the butter.',
        tips: 'Low heat is key - rushing will make them rubbery'
      },
      {
        step: 3,
        description: 'Pour in eggs and let them sit for 20 seconds without stirring.',
        tips: 'This creates the first layer of cooked egg'
      },
      {
        step: 4,
        description: 'Using a spatula, gently push cooked edges toward center, tilting pan to let raw egg flow underneath.',
        tips: 'Work slowly and be patient - this takes 3-4 minutes'
      },
      {
        step: 5,
        description: 'When eggs are almost set but still slightly wet, remove from heat. Add remaining butter and fold gently.',
        tips: 'The residual heat will finish cooking them perfectly'
      },
      {
        step: 6,
        description: 'Garnish with chives and serve immediately.',
        tips: 'Scrambled eggs continue cooking even off heat, so serve quickly'
      }
    ],
    tips: [
      'Use room temperature eggs for even cooking',
      'Never cook scrambled eggs on high heat',
      'The key is patience - slow and low wins the race',
      'Adding butter at the end creates extra richness'
    ],
    imageUrl: '/tutorials/scrambled-eggs.jpg',
    skillsLearned: ['temperature-control', 'timing', 'basic-techniques'],
    nutritionInfo: {
      calories: 320,
      protein: 18,
      carbs: 2,
      fat: 26
    }
  },
  {
    id: 'knife-skills-basics',
    title: 'Essential Knife Skills',
    description: 'Master the fundamental cuts every home cook needs to know',
    difficulty: 'beginner',
    cookingTime: 30,
    category: 'knife-skills',
    ingredients: [
      { name: 'Yellow onion', quantity: '1 large' },
      { name: 'Carrot', quantity: '2 large' },
      { name: 'Celery stalks', quantity: '3' },
      { name: 'Bell pepper', quantity: '1' },
      { name: 'Fresh herbs', quantity: 'As needed', notes: 'Parsley, basil, or cilantro' }
    ],
    instructions: [
      {
        step: 1,
        description: 'Learn proper knife grip: pinch the blade with thumb and forefinger, wrap other fingers around handle.',
        tips: 'This grip gives you maximum control and safety'
      },
      {
        step: 2,
        description: 'Practice the "claw grip" with your guiding hand - fingers curved, knuckles forward.',
        tips: 'Your knuckles guide the knife and protect your fingertips'
      },
      {
        step: 3,
        description: 'Dice an onion: Cut in half through root, peel, make horizontal cuts, then vertical cuts.',
        tips: 'Keep the root end intact until the final cuts for better control'
      },
      {
        step: 4,
        description: 'Julienne carrots: Cut into 2-3 inch segments, slice thinly, then cut into matchsticks.',
        tips: 'Create a flat surface by cutting a small slice off one side first'
      },
      {
        step: 5,
        description: 'Chop celery: Remove leaves, cut stalks at an angle for better presentation.',
        tips: 'Angle cuts expose more surface area and look more professional'
      },
      {
        step: 6,
        description: 'Chiffonade herbs: Stack leaves, roll tightly, slice into thin ribbons.',
        tips: 'This technique works best with larger, flat leaves like basil'
      }
    ],
    tips: [
      'Keep your knife sharp - dull knives are dangerous',
      'Take your time when learning - speed comes with practice',
      'Practice on inexpensive vegetables before trying expensive ingredients',
      'Clean your cutting board between different ingredients'
    ],
    imageUrl: '/tutorials/knife-skills.jpg',
    skillsLearned: ['knife-safety', 'dicing', 'julienne', 'chiffonade', 'knife-maintenance']
  },
  {
    id: 'perfect-sauteed-vegetables',
    title: 'Perfect Sautéed Vegetables',
    description: 'Learn the art of sautéing for perfectly cooked, flavorful vegetables',
    difficulty: 'intermediate',
    cookingTime: 15,
    category: 'sauteing',
    ingredients: [
      { name: 'Mixed vegetables', quantity: '4 cups', notes: 'Cut uniformly' },
      { name: 'Olive oil', quantity: '3 tbsp' },
      { name: 'Garlic', quantity: '3 cloves', notes: 'Minced' },
      { name: 'Salt', quantity: 'To taste' },
      { name: 'Black pepper', quantity: 'To taste' },
      { name: 'Fresh lemon juice', quantity: '1 tbsp' },
      { name: 'Fresh herbs', quantity: '2 tbsp', notes: 'Chopped' }
    ],
    instructions: [
      {
        step: 1,
        description: 'Heat pan over medium-high heat until hot but not smoking.',
        tips: 'Test heat by sprinkling a few drops of water - they should sizzle and evaporate quickly'
      },
      {
        step: 2,
        description: 'Add oil and swirl to coat the pan evenly.',
        tips: 'Oil should shimmer but not smoke'
      },
      {
        step: 3,
        description: 'Add harder vegetables first (carrots, broccoli stems), cook for 2-3 minutes.',
        tips: 'Vegetables should sizzle when they hit the pan'
      },
      {
        step: 4,
        description: 'Add medium-cooking vegetables (broccoli florets, bell peppers).',
        tips: 'Keep vegetables moving with frequent tossing'
      },
      {
        step: 5,
        description: 'Add soft vegetables last (zucchini, spinach), along with garlic.',
        tips: 'Garlic burns easily, so add it near the end'
      },
      {
        step: 6,
        description: 'Season with salt, pepper, lemon juice, and herbs. Toss and serve immediately.',
        tips: 'Vegetables should be tender-crisp, not mushy'
      }
    ],
    tips: [
      'Cut all vegetables the same size for even cooking',
      'Don\'t overcrowd the pan - cook in batches if necessary',
      'Keep vegetables moving to prevent burning',
      'Season at the end to prevent drawing out moisture too early'
    ],
    imageUrl: '/tutorials/sauteed-vegetables.jpg',
    skillsLearned: ['heat-control', 'timing', 'seasoning', 'vegetable-preparation']
  }
];

export const cookingSkills: CookingSkill[] = [
  {
    id: 'knife-safety',
    name: 'Knife Safety & Maintenance',
    description: 'Essential safety techniques and proper knife care',
    difficulty: 'beginner',
    category: 'knife',
    relatedTutorials: ['knife-skills-basics']
  },
  {
    id: 'heat-control',
    name: 'Heat Control & Temperature',
    description: 'Understanding when to use different heat levels',
    difficulty: 'intermediate',
    category: 'heat',
    relatedTutorials: ['perfect-sauteed-vegetables', 'perfect-scrambled-eggs']
  },
  {
    id: 'seasoning-timing',
    name: 'Seasoning & Timing',
    description: 'When and how to season for maximum flavor',
    difficulty: 'intermediate',
    category: 'seasoning',
    relatedTutorials: ['perfect-sauteed-vegetables']
  }
];