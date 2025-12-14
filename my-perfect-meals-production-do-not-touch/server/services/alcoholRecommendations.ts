interface UserProfile {
  diabetic?: boolean;
  goal?: string;
  alcoholSensitivity?: string;
  allergies?: string[];
  medications?: string[];
}

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

export async function generateWineRecommendation(
  goal: string,
  pairing: string,
  taste: string,
  userProfile: UserProfile
): Promise<AlcoholRecommendation> {
  const isDiabetic = userProfile.diabetic;
  const isWeightLoss = userProfile.goal?.toLowerCase().includes('fat loss') || userProfile.goal?.toLowerCase().includes('weight loss');

  return {
    name: "Pinot Grigio Reserve",
    type: "White Wine",
    description: "Crisp, dry white wine with bright acidity and mineral notes",
    alcoholContent: "12.5% ABV",
    calories: 120,
    sugar: "Bone dry (0g residual sugar)",
    pairingReason: `The wine's crisp acidity and light body complement ${pairing} without overwhelming the flavors`,
    healthNotes: isDiabetic ? [
      "Zero residual sugar makes this diabetic-friendly",
      "Lower alcohol content reduces blood sugar impact"
    ] : [
      "Moderate calorie content",
      "Rich in antioxidants"
    ],
    medicalCompatibility: {
      diabeticFriendly: true,
      lowCalorie: isWeightLoss || false,
      reason: isDiabetic ? "Dry wines have minimal sugar content" : "Moderate calorie wine option"
    }
  };
}

export async function generateLiquorRecommendation(
  goal: string,
  pairing: string,
  taste: string,
  userProfile: UserProfile
): Promise<AlcoholRecommendation> {
  const isDiabetic = userProfile.diabetic;

  return {
    name: "Blanco Tequila",
    type: "Premium Spirit",
    description: "100% blue agave tequila with clean, smooth finish",
    alcoholContent: "40% ABV",
    calories: 69,
    sugar: "0g (naturally sugar-free)",
    ingredients: ["100% Blue Agave"],
    instructions: [
      "Serve neat in a snifter glass",
      "Add a lime wheel if desired",
      "Sip slowly to appreciate the agave flavors"
    ],
    pairingReason: `The clean agave flavors won't compete with ${pairing} and provide a palate-cleansing effect`,
    healthNotes: isDiabetic ? [
      "Zero sugar content is ideal for diabetics",
      "Pure agave source provides cleaner alcohol"
    ] : [
      "Lower calorie spirit option",
      "No artificial additives"
    ],
    medicalCompatibility: {
      diabeticFriendly: true,
      lowCalorie: true,
      reason: "Pure agave spirits contain no added sugars"
    }
  };
}

export async function generateBeerRecommendation(
  goal: string,
  pairing: string,
  taste: string,
  userProfile: UserProfile
): Promise<AlcoholRecommendation> {
  const isDiabetic = userProfile.diabetic;
  const isWeightLoss = userProfile.goal?.toLowerCase().includes('fat loss');

  return {
    name: "Light Wheat Beer",
    type: "Low-Carb Beer",
    description: "Crisp, refreshing wheat beer with reduced carbohydrates",
    alcoholContent: "4.2% ABV",
    calories: 95,
    sugar: "2.6g carbs",
    ingredients: ["Wheat", "Hops", "Yeast", "Water"],
    pairingReason: `The light, crisp profile complements ${pairing} without overwhelming the meal`,
    healthNotes: isDiabetic ? [
      "Lower carb content reduces blood sugar impact",
      "Light alcohol percentage"
    ] : [
      "Reduced calorie beer option",
      "Natural ingredients only"
    ],
    medicalCompatibility: {
      diabeticFriendly: true,
      lowCalorie: true,
      reason: "Low-carb beers have reduced sugar content"
    }
  };
}

export async function generateMocktailRecommendation(
  goal: string,
  pairing: string,
  taste: string,
  userProfile: UserProfile
): Promise<AlcoholRecommendation> {
  const isDiabetic = userProfile.diabetic;

  return {
    name: "Sparkling Berry Mint Refresher",
    type: "Sugar-Free Mocktail",
    description: "Refreshing blend of fresh berries, mint, and sparkling water",
    alcoholContent: "0% ABV",
    calories: 25,
    sugar: "0g (stevia sweetened)",
    ingredients: [
      "Fresh mixed berries",
      "Fresh mint leaves",
      "Sparkling water",
      "Stevia extract",
      "Fresh lime juice"
    ],
    instructions: [
      "Muddle berries and mint in a glass",
      "Add ice and lime juice",
      "Top with sparkling water",
      "Sweeten with stevia to taste",
      "Garnish with mint sprig"
    ],
    pairingReason: `The bright, fruity flavors and effervescence cleanse the palate between bites of ${pairing}`,
    healthNotes: isDiabetic ? [
      "Zero sugar with natural stevia sweetening",
      "Rich in antioxidants from fresh berries",
      "No alcohol impact on blood sugar"
    ] : [
      "Very low calorie option",
      "Hydrating and refreshing",
      "Natural fruit vitamins"
    ],
    medicalCompatibility: {
      diabeticFriendly: true,
      lowCalorie: true,
      reason: "Sugar-free mocktails provide flavor without blood sugar impact"
    }
  };
}

export async function generateMixerRecommendation(
  goal: string,
  pairing: string,
  taste: string,
  userProfile: UserProfile
): Promise<AlcoholRecommendation> {
  const isDiabetic = userProfile.diabetic;

  return {
    name: "Cucumber Lime Soda",
    type: "Low-Cal Mixer",
    description: "Refreshing zero-sugar mixer with natural cucumber and lime",
    alcoholContent: "0% ABV",
    calories: 5,
    sugar: "0g",
    ingredients: [
      "Sparkling water",
      "Natural cucumber essence",
      "Fresh lime juice",
      "Stevia extract",
      "Natural flavoring"
    ],
    instructions: [
      "Chill thoroughly before serving",
      "Mix with spirits of choice (1:3 ratio)",
      "Garnish with cucumber slice",
      "Serve over ice"
    ],
    pairingReason: `The clean, refreshing profile enhances spirits without masking the ${pairing} flavors`,
    healthNotes: isDiabetic ? [
      "Zero sugar content safe for diabetics",
      "Natural cucumber provides electrolytes"
    ] : [
      "Ultra-low calorie mixer option",
      "Natural ingredients only"
    ],
    medicalCompatibility: {
      diabeticFriendly: true,
      lowCalorie: true,
      reason: "Sugar-free mixers don't add carbohydrates to drinks"
    }
  };
}

export async function generateCigarRecommendation(
  goal: string,
  pairing: string,
  taste: string,
  userProfile: UserProfile
): Promise<AlcoholRecommendation> {
  return {
    name: "Mild Connecticut Shade",
    type: "Premium Cigar",
    description: "Smooth, mild-bodied cigar with creamy, nutty flavors",
    ingredients: [
      "Connecticut shade wrapper",
      "Dominican binder",
      "Honduran/Dominican filler"
    ],
    instructions: [
      "Cut with a guillotine cutter",
      "Toast the foot evenly",
      "Light slowly with cedar spills",
      "Rotate while smoking for even burn",
      "Enjoy for 45-60 minutes"
    ],
    pairingReason: `The mild, creamy profile complements ${pairing} without overwhelming the palate`,
    healthNotes: [
      "Premium tobacco quality",
      "Mild strength reduces nicotine impact",
      "Hand-rolled construction"
    ],
    medicalCompatibility: {
      diabeticFriendly: false,
      lowCalorie: true,
      reason: "Tobacco products not recommended for diabetics or health-conscious individuals"
    }
  };
}

export async function generateWeaningRecommendation(
  goal: string,
  pairing: string,
  taste: string,
  userProfile: UserProfile
): Promise<AlcoholRecommendation> {
  const isDiabetic = userProfile.diabetic;

  return {
    name: "Adaptogenic Stress Relief Tea",
    type: "Alcohol Alternative",
    description: "Calming herbal blend designed to reduce alcohol cravings",
    alcoholContent: "0% ABV",
    calories: 10,
    sugar: "0g",
    ingredients: [
      "Ashwagandha root",
      "Chamomile flowers",
      "Lemon balm",
      "Passionflower",
      "L-theanine",
      "Natural lavender"
    ],
    instructions: [
      "Steep 1 tea bag in hot water for 5-7 minutes",
      "Add honey or stevia if desired",
      "Drink 30 minutes before usual drinking time",
      "Practice deep breathing while sipping",
      "Use as a ritual replacement"
    ],
    pairingReason: `The calming herbs help manage stress that often triggers alcohol cravings around meal times like ${pairing}`,
    healthNotes: isDiabetic ? [
      "Sugar-free and diabetic-safe",
      "Adaptogenic herbs support blood sugar stability",
      "Natural stress reduction"
    ] : [
      "Supports nervous system health",
      "Reduces cortisol levels",
      "Improves sleep quality"
    ],
    medicalCompatibility: {
      diabeticFriendly: true,
      lowCalorie: true,
      reason: "Herbal alternatives support overall health while reducing alcohol dependence"
    }
  };
}