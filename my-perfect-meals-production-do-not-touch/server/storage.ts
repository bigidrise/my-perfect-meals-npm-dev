import { type User, type InsertUser, type Recipe, type InsertRecipe, type MealPlan, type InsertMealPlan, type MealLog, type InsertMealLog, type ShoppingList, type InsertShoppingList, type MealReminder, type InsertMealReminder, type MentalHealthConversation, type InsertMentalHealthConversation, type UserGlycemicSettings, type InsertUserGlycemicSettings, type GlucoseLog, type InsertGlucoseLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Recipe methods
  getRecipes(filters?: { dietaryRestrictions?: string[], mealType?: string, tags?: string[] }): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  searchRecipes(query: string): Promise<Recipe[]>;

  // Meal plan methods
  getMealPlans(userId: string): Promise<MealPlan[]>;
  getMealPlan(id: string): Promise<MealPlan | undefined>;
  createMealPlan(mealPlan: InsertMealPlan): Promise<MealPlan>;
  updateMealPlan(id: string, updates: Partial<InsertMealPlan>): Promise<MealPlan | undefined>;
  deleteMealPlan(id: string): Promise<boolean>;

  // Meal log methods
  getMealLogs(userId: string, startDate?: Date, endDate?: Date): Promise<MealLog[]>;
  createMealLog(mealLog: InsertMealLog): Promise<MealLog>;

  // Shopping list methods
  getShoppingLists(userId: string): Promise<ShoppingList[]>;
  getShoppingListItems(userId: string): Promise<any[]>;
  addShoppingListItem(item: any): Promise<any>;
  updateShoppingListItem(id: string, updates: any): Promise<any>;
  deleteShoppingListItem(id: string): Promise<boolean>;
  clearPurchasedItems(userId: string): Promise<boolean>;
  createShoppingList(shoppingList: InsertShoppingList): Promise<ShoppingList>;
  updateShoppingList(id: string, updates: Partial<InsertShoppingList>): Promise<ShoppingList | undefined>;

  // Meal reminder methods
  getMealReminders(userId: string): Promise<MealReminder[]>;
  createMealReminder(reminder: InsertMealReminder): Promise<MealReminder>;
  updateMealReminder(id: string, updates: Partial<InsertMealReminder>): Promise<MealReminder | undefined>;
  deleteMealReminder(id: string): Promise<boolean>;

  // Mental health conversation methods
  getMentalHealthConversations(userId: string, limit?: number): Promise<MentalHealthConversation[]>;
  createMentalHealthConversation(conversation: InsertMentalHealthConversation): Promise<MentalHealthConversation>;
  rateMentalHealthConversation(conversationId: string, rating: number): Promise<void>;

  // Glycemic settings methods
  getUserGlycemicSettings(userId: string): Promise<UserGlycemicSettings | undefined>;
  createOrUpdateGlycemicSettings(settings: InsertUserGlycemicSettings): Promise<UserGlycemicSettings>;

  // Push notification methods
  savePushSubscription(userId: string, subscription: any): Promise<void>;
  getPushSubscription(userId: string): Promise<any>;
  removePushSubscription(userId: string): Promise<void>;

  // Alcohol logging methods
  getAlcoholEntries(userId: string, startDate: string): Promise<any[]>;

  // Physician report methods
  createPhysicianReport(report: any): Promise<any>;
  getPhysicianReport(accessCode: string): Promise<any | undefined>;
  getPhysicianReportById(id: string): Promise<any | undefined>;
  getUserPhysicianReports(userId: string): Promise<any[]>;
  trackPhysicianReportView(accessCode: string): Promise<void>;

  // Glucose log methods
  getGlucoseLogs(userId: string, startDate?: Date, endDate?: Date): Promise<GlucoseLog[]>;
  getLatestGlucoseLog(userId: string): Promise<GlucoseLog | undefined>;
  createGlucoseLog(glucoseLog: InsertGlucoseLog): Promise<GlucoseLog>;

  // Password reset methods
  setPasswordResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<boolean>;
  getUserByResetToken(tokenHash: string): Promise<User | undefined>;
  updatePasswordByResetToken(tokenHash: string, newPasswordHash: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private recipes: Map<string, Recipe>;
  private mealPlans: Map<string, MealPlan>;
  private mealLogs: Map<string, MealLog>;
  private shoppingLists: Map<string, ShoppingList>;
  private mealReminders: Map<string, MealReminder>;
  private mentalHealthConversations: Map<string, MentalHealthConversation>;
  private glycemicSettings: Map<string, UserGlycemicSettings>;
  private shoppingListItems: Map<string, any>;
  private pushSubscriptions: Map<string, any>;
  private physicianReports: Map<string, any>;
  private glucoseLogs: Map<string, GlucoseLog>;

  constructor() {
    this.users = new Map();
    this.recipes = new Map();
    this.mealPlans = new Map();
    this.mealLogs = new Map();
    this.shoppingLists = new Map();
    this.mealReminders = new Map();
    this.mentalHealthConversations = new Map();
    this.glycemicSettings = new Map();
    this.shoppingListItems = new Map();
    this.pushSubscriptions = new Map();
    this.physicianReports = new Map();
    this.glucoseLogs = new Map();
    
    // Initialize with sample data
    this.initializeSampleRecipes();
    this.initializeSampleUser();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser,
      id, 
      createdAt: new Date(),
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      age: insertUser.age || null,
      height: insertUser.height || null,
      weight: insertUser.weight || null,
      activityLevel: insertUser.activityLevel || null,
      bodyType: insertUser.bodyType || null,
      fitnessGoal: insertUser.fitnessGoal || null,
      dailyCalorieTarget: insertUser.dailyCalorieTarget || null,
      dietaryRestrictions: insertUser.dietaryRestrictions || null,
      healthConditions: insertUser.healthConditions || null,
      allergies: insertUser.allergies || null,
      dislikedFoods: insertUser.dislikedFoods || null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Recipe methods
  async getRecipes(filters?: { dietaryRestrictions?: string[], mealType?: string, tags?: string[] }): Promise<Recipe[]> {
    let recipes = Array.from(this.recipes.values());
    
    if (filters?.dietaryRestrictions?.length) {
      recipes = recipes.filter(recipe => 
        filters.dietaryRestrictions!.some(restriction => 
          recipe.dietaryRestrictions?.includes(restriction)
        )
      );
    }
    
    if (filters?.mealType) {
      recipes = recipes.filter(recipe => recipe.mealType === filters.mealType);
    }
    
    if (filters?.tags?.length) {
      recipes = recipes.filter(recipe => 
        filters.tags!.some(tag => recipe.tags?.includes(tag))
      );
    }
    
    return recipes;
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    const id = randomUUID();
    const recipe: Recipe = { 
      ...insertRecipe,
      id, 
      createdAt: new Date(),
      description: insertRecipe.description || null,
      imageUrl: insertRecipe.imageUrl || null,
      prepTime: insertRecipe.prepTime || null,
      cookTime: insertRecipe.cookTime || null,
      servings: insertRecipe.servings || null,
      calories: insertRecipe.calories || null,
      protein: insertRecipe.protein || null,
      carbs: insertRecipe.carbs || null,
      fat: insertRecipe.fat || null,
      fiber: insertRecipe.fiber || null,
      sugar: insertRecipe.sugar || null,
      sodium: insertRecipe.sodium || null,
      ingredients: insertRecipe.ingredients || null,
      instructions: insertRecipe.instructions || null,
      tags: insertRecipe.tags || null,
      mealType: insertRecipe.mealType || null,
      dietaryRestrictions: insertRecipe.dietaryRestrictions || null
    };
    this.recipes.set(id, recipe);
    return recipe;
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    const recipes = Array.from(this.recipes.values());
    const lowercaseQuery = query.toLowerCase();
    
    return recipes.filter(recipe => 
      recipe.name.toLowerCase().includes(lowercaseQuery) ||
      recipe.description?.toLowerCase().includes(lowercaseQuery) ||
      recipe.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Meal plan methods
  async getMealPlans(userId: string): Promise<MealPlan[]> {
    return Array.from(this.mealPlans.values()).filter(plan => plan.userId === userId);
  }

  async getMealPlan(id: string): Promise<MealPlan | undefined> {
    return this.mealPlans.get(id);
  }

  async createMealPlan(insertMealPlan: InsertMealPlan): Promise<MealPlan> {
    const id = randomUUID();
    const mealPlan: MealPlan = { 
      ...insertMealPlan,
      id, 
      createdAt: new Date(),
      meals: insertMealPlan.meals || null,
      totalCalories: insertMealPlan.totalCalories || null,
      totalProtein: insertMealPlan.totalProtein || null,
      totalCarbs: insertMealPlan.totalCarbs || null,
      totalFat: insertMealPlan.totalFat || null,
      isActive: insertMealPlan.isActive || null
    };
    this.mealPlans.set(id, mealPlan);
    return mealPlan;
  }

  async updateMealPlan(id: string, updates: Partial<InsertMealPlan>): Promise<MealPlan | undefined> {
    const mealPlan = this.mealPlans.get(id);
    if (!mealPlan) return undefined;
    
    const updatedMealPlan = { ...mealPlan, ...updates };
    this.mealPlans.set(id, updatedMealPlan);
    return updatedMealPlan;
  }

  async deleteMealPlan(id: string): Promise<boolean> {
    return this.mealPlans.delete(id);
  }

  // Meal log methods
  async getMealLogs(userId: string, startDate?: Date, endDate?: Date): Promise<MealLog[]> {
    let logs = Array.from(this.mealLogs.values()).filter(log => log.userId === userId);
    
    if (startDate) {
      logs = logs.filter(log => log.date >= startDate);
    }
    
    if (endDate) {
      logs = logs.filter(log => log.date <= endDate);
    }
    
    return logs.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async createMealLog(insertMealLog: InsertMealLog): Promise<MealLog> {
    const id = randomUUID();
    const mealLog: MealLog = { 
      ...insertMealLog,
      id, 
      createdAt: new Date(),
      servings: insertMealLog.servings || null,
      notes: insertMealLog.notes || null
    };
    this.mealLogs.set(id, mealLog);
    return mealLog;
  }

  // Shopping list methods
  async getShoppingLists(userId: string): Promise<ShoppingList[]> {
    return Array.from(this.shoppingLists.values()).filter(list => list.userId === userId);
  }

  async createShoppingList(insertShoppingList: InsertShoppingList): Promise<ShoppingList> {
    const id = randomUUID();
    const shoppingList: ShoppingList = { 
      ...insertShoppingList,
      id, 
      createdAt: new Date(),
      mealPlanId: insertShoppingList.mealPlanId || null,
      items: insertShoppingList.items || null
    };
    this.shoppingLists.set(id, shoppingList);
    return shoppingList;
  }

  async updateShoppingList(id: string, updates: Partial<InsertShoppingList>): Promise<ShoppingList | undefined> {
    const shoppingList = this.shoppingLists.get(id);
    if (!shoppingList) return undefined;
    
    const updatedShoppingList = { ...shoppingList, ...updates };
    this.shoppingLists.set(id, updatedShoppingList);
    return updatedShoppingList;
  }

  // Additional shopping list methods for item management

  async getShoppingListItems(userId: string): Promise<any[]> {
    return Array.from(this.shoppingListItems.values()).filter(item => item.userId === userId);
  }

  async addShoppingListItem(item: any): Promise<any> {
    const id = randomUUID();
    const newItem = {
      ...item,
      id,
      createdAt: new Date().toISOString()
    };
    this.shoppingListItems.set(id, newItem);
    return newItem;
  }

  async updateShoppingListItem(id: string, updates: any): Promise<any> {
    const item = this.shoppingListItems.get(id);
    if (!item) throw new Error('Item not found');
    
    const updatedItem = { ...item, ...updates };
    this.shoppingListItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteShoppingListItem(id: string): Promise<boolean> {
    return this.shoppingListItems.delete(id);
  }

  async clearPurchasedItems(userId: string): Promise<boolean> {
    const items = Array.from(this.shoppingListItems.entries());
    let deleted = 0;
    
    for (const [id, item] of items) {
      if (item.userId === userId && item.purchased) {
        this.shoppingListItems.delete(id);
        deleted++;
      }
    }
    
    return deleted > 0;
  }

  private initializeSampleRecipes() {
    const sampleRecipes: (InsertRecipe & { id: string })[] = [
      {
        id: "1",
        name: "Greek Yogurt Bowl",
        description: "Protein-rich Greek yogurt topped with fresh berries and granola",
        imageUrl: null,
        prepTime: 5,
        cookTime: 0,
        servings: 1,
        calories: 385,
        protein: 20,
        carbs: 45,
        fat: 12,
        fiber: 8,
        sugar: 25,
        sodium: 85,
        ingredients: [
          { name: "Greek yogurt", amount: "1", unit: "cup" },
          { name: "Mixed berries", amount: "1/2", unit: "cup" },
          { name: "Granola", amount: "2", unit: "tbsp" },
          { name: "Honey", amount: "1", unit: "tsp" },
          { name: "Vanilla extract", amount: "1/4", unit: "tsp" },
          { name: "Cinnamon", amount: "1 pinch", unit: "" }
        ],
        instructions: [
          "Add Greek yogurt to bowl",
          "Mix in vanilla extract and a pinch of cinnamon",
          "Top with mixed berries",
          "Sprinkle granola on top",
          "Drizzle with honey"
        ],
        tags: ["quick", "high-protein", "breakfast"],
        mealType: "breakfast",
        dietaryRestrictions: ["vegetarian", "gluten-free"]
      },
      {
        id: "2",
        name: "Quinoa Power Bowl",
        description: "Nutrient-packed quinoa bowl with grilled chicken and vegetables",
        imageUrl: null,
        prepTime: 15,
        cookTime: 20,
        servings: 1,
        calories: 645,
        protein: 35,
        carbs: 52,
        fat: 28,
        fiber: 12,
        sugar: 8,
        sodium: 420,
        ingredients: [
          { name: "Quinoa", amount: "1/2", unit: "cup" },
          { name: "Grilled chicken breast", amount: "4", unit: "oz" },
          { name: "Avocado", amount: "1/2", unit: "medium" },
          { name: "Mixed vegetables", amount: "1", unit: "cup" },
          { name: "Olive oil", amount: "1", unit: "tbsp" },
          { name: "Salt", amount: "1/2", unit: "tsp" },
          { name: "Black pepper", amount: "1/4", unit: "tsp" },
          { name: "Garlic powder", amount: "1/2", unit: "tsp" },
          { name: "Lemon juice", amount: "1", unit: "tbsp" }
        ],
        instructions: [
          "Cook quinoa according to package directions, season with salt",
          "Season chicken breast with salt, pepper, and garlic powder",
          "Grill chicken breast until cooked through",
          "Steam mixed vegetables until tender",
          "Assemble bowl with quinoa, chicken, vegetables, and avocado",
          "Drizzle with olive oil and lemon juice"
        ],
        tags: ["high-protein", "balanced", "lunch"],
        mealType: "lunch",
        dietaryRestrictions: ["gluten-free"]
      },
      {
        id: "3",
        name: "Salmon & Vegetables",
        description: "Grilled salmon fillet with roasted vegetables and sweet potato",
        imageUrl: null,
        prepTime: 10,
        cookTime: 25,
        servings: 1,
        calories: 520,
        protein: 32,
        carbs: 35,
        fat: 26,
        fiber: 7,
        sugar: 12,
        sodium: 185,
        ingredients: [
          { name: "Salmon fillet", amount: "5", unit: "oz" },
          { name: "Sweet potato", amount: "1", unit: "medium" },
          { name: "Broccoli", amount: "1", unit: "cup" },
          { name: "Bell peppers", amount: "1/2", unit: "cup" },
          { name: "Olive oil", amount: "1", unit: "tbsp" },
          { name: "Salt", amount: "1/2", unit: "tsp" },
          { name: "Black pepper", amount: "1/4", unit: "tsp" },
          { name: "Paprika", amount: "1/2", unit: "tsp" },
          { name: "Garlic powder", amount: "1/2", unit: "tsp" },
          { name: "Lemon", amount: "1/2", unit: "whole" }
        ],
        instructions: [
          "Preheat oven to 400°F",
          "Cut sweet potato and vegetables into chunks",
          "Toss vegetables with half the olive oil, salt, pepper, and garlic powder",
          "Roast vegetables for 20 minutes",
          "Season salmon with salt, pepper, paprika, and garlic powder",
          "Grill salmon for 4-5 minutes per side",
          "Squeeze lemon over salmon before serving",
          "Serve salmon with roasted vegetables"
        ],
        tags: ["omega-3", "heart-healthy", "dinner"],
        mealType: "dinner",
        dietaryRestrictions: ["gluten-free", "dairy-free"]
      }
    ];

    sampleRecipes.forEach(recipe => {
      const completeRecipe: Recipe = {
        ...recipe,
        createdAt: new Date(),
        description: recipe.description || null,
        imageUrl: recipe.imageUrl || null,
        prepTime: recipe.prepTime || null,
        cookTime: recipe.cookTime || null,
        servings: recipe.servings || null,
        calories: recipe.calories || null,
        protein: recipe.protein || null,
        carbs: recipe.carbs || null,
        fat: recipe.fat || null,
        fiber: recipe.fiber || null,
        sugar: recipe.sugar || null,
        sodium: recipe.sodium || null,
        ingredients: recipe.ingredients || null,
        instructions: recipe.instructions || null,
        tags: recipe.tags || null,
        mealType: recipe.mealType || null,
        dietaryRestrictions: recipe.dietaryRestrictions || null
      };
      this.recipes.set(recipe.id, completeRecipe);
    });
  }

  private initializeSampleUser() {
    const sampleUser: User = {
      id: "1",
      username: "demo_user",
      email: "demo@example.com",
      password: "demo_password",
      firstName: "Demo",
      lastName: "User",
      age: 30,
      height: 175, // cm
      weight: 70, // kg
      activityLevel: "moderately_active",
      bodyType: "mesomorph",
      fitnessGoal: "weight_loss",
      fitnessGoals: ["lose_weight", "build_muscle"], // Added array format for OpenAI integration
      dailyCalorieTarget: 2000,
      dietaryRestrictions: ["gluten-free"],
      healthConditions: ["diabetes", "hypertension"],
      allergies: ["shellfish", "nuts"],
      dislikedFoods: ["liver", "mushrooms"],
      subscriptionPlan: "ultimate",
      subscriptionStatus: "active",
      subscriptionExpiresAt: new Date("2025-12-31"),
      createdAt: new Date()
    };
    
    this.users.set(sampleUser.id, sampleUser);
    
    // Initialize sample meal plan with structured meals containing ingredients
    this.initializeSampleMealPlan();
  }

  private initializeSampleMealPlan() {
    const sampleMealPlan: MealPlan = {
      id: "weekly-plan-1",
      userId: "1",
      name: "Healthy Weekly Plan",
      weekOf: new Date(),
      meals: {
        monday: {
          breakfast: "Grilled Chicken & Quinoa Bowl",
          lunch: "Salmon Avocado Salad",
          dinner: "Turkey Meatballs with Sweet Potato"
        },
        tuesday: {
          breakfast: "Greek Yogurt Parfait",
          lunch: "Lemon Herb Cod",
          dinner: "Beef Stir Fry"
        }
      },
      totalCalories: 14000,
      totalProtein: 980,
      totalCarbs: 1400,
      totalFat: 560,
      isActive: true,
      createdAt: new Date()
    };
    
    this.mealPlans.set(sampleMealPlan.id, sampleMealPlan);
  }

  // Meal reminder methods
  async getMealReminders(userId: string): Promise<MealReminder[]> {
    return Array.from(this.mealReminders.values()).filter(
      (reminder) => reminder.userId === userId
    );
  }

  async createMealReminder(insertReminder: InsertMealReminder): Promise<MealReminder> {
    const id = randomUUID();
    const reminder: MealReminder = {
      ...insertReminder,
      id,
      createdAt: new Date(),
      lastSent: insertReminder.lastSent || null,
      isActive: insertReminder.isActive ?? true,
      reminderEnabled: insertReminder.reminderEnabled ?? true,
      dayOfWeek: insertReminder.dayOfWeek || null,
      timezone: insertReminder.timezone || "UTC",
      mealPlanId: insertReminder.mealPlanId || null,
      recipeId: insertReminder.recipeId || null
    };
    this.mealReminders.set(id, reminder);
    return reminder;
  }

  async updateMealReminder(id: string, updates: Partial<InsertMealReminder>): Promise<MealReminder | undefined> {
    const reminder = this.mealReminders.get(id);
    if (!reminder) return undefined;
    
    const updatedReminder = { ...reminder, ...updates };
    this.mealReminders.set(id, updatedReminder);
    return updatedReminder;
  }

  async deleteMealReminder(id: string): Promise<boolean> {
    return this.mealReminders.delete(id);
  }

  // Mental health conversation methods
  async getMentalHealthConversations(userId: string, limit: number = 10): Promise<MentalHealthConversation[]> {
    return Array.from(this.mentalHealthConversations.values())
      .filter(conversation => conversation.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async createMentalHealthConversation(insertConversation: InsertMentalHealthConversation): Promise<MentalHealthConversation> {
    const id = randomUUID();
    const conversation: MentalHealthConversation = {
      ...insertConversation,
      id,
      createdAt: new Date(),
      followUp: insertConversation.followUp ?? false,
      previousConversationId: insertConversation.previousConversationId || null,
      userSatisfaction: insertConversation.userSatisfaction || null
    };
    this.mentalHealthConversations.set(id, conversation);
    return conversation;
  }

  async rateMentalHealthConversation(conversationId: string, rating: number): Promise<void> {
    const conversation = this.mentalHealthConversations.get(conversationId);
    if (conversation) {
      const updatedConversation = { ...conversation, userSatisfaction: rating };
      this.mentalHealthConversations.set(conversationId, updatedConversation);
    }
  }

  // Glycemic settings methods
  async getUserGlycemicSettings(userId: string): Promise<UserGlycemicSettings | undefined> {
    return Array.from(this.glycemicSettings.values()).find(settings => settings.userId === userId);
  }

  async createOrUpdateGlycemicSettings(insertSettings: InsertUserGlycemicSettings): Promise<UserGlycemicSettings> {
    // Find existing settings for this user
    const existingSettings = await this.getUserGlycemicSettings(insertSettings.userId);
    
    if (existingSettings) {
      // Update existing settings
      const updatedSettings: UserGlycemicSettings = {
        ...existingSettings,
        ...insertSettings,
        updatedAt: new Date()
      };
      this.glycemicSettings.set(existingSettings.id, updatedSettings);
      return updatedSettings;
    } else {
      // Create new settings
      const id = randomUUID();
      const newSettings: UserGlycemicSettings = {
        ...insertSettings,
        id,
        updatedAt: new Date(),
        bloodGlucose: insertSettings.bloodGlucose || null,
        preferredCarbs: insertSettings.preferredCarbs || null,
        defaultPortion: insertSettings.defaultPortion || null
      };
      this.glycemicSettings.set(id, newSettings);
      return newSettings;
    }
  }

  // Push notification methods
  async savePushSubscription(userId: string, subscription: any): Promise<void> {
    this.pushSubscriptions.set(userId, subscription);
  }

  async getPushSubscription(userId: string): Promise<any> {
    return this.pushSubscriptions.get(userId);
  }

  async removePushSubscription(userId: string): Promise<void> {
    this.pushSubscriptions.delete(userId);
  }

  // Alcohol logging methods
  async getAlcoholEntries(userId: string, startDate: string): Promise<any[]> {
    // Get food logs that are marked as alcohol entries
    const allLogs = Array.from(this.mealLogs.values()).filter(log => log.userId === userId);
    
    // Filter for alcohol entries after the start date
    const alcoholLogs = allLogs.filter(log => {
      // Check if this is an alcohol entry (assuming we store this metadata)
      const isAlcohol = (log as any).isAlcohol === true || (log as any).isAlcohol === 1;
      const logDate = new Date(log.date);
      const startDateTime = new Date(startDate);
      
      return isAlcohol && logDate >= startDateTime;
    });

    // Transform to expected format
    return alcoholLogs.map(log => ({
      id: log.id,
      loggedAt: log.date.toISOString(),
      label: (log as any).label || "Alcohol",
      amountOz: (log as any).amountOz || 0,
      kcal: log.calories || 0,
      carbs: log.carbs || 0,
      notes: log.notes || null,
      isAlcohol: true
    }));
  }

  // Physician report methods
  async createPhysicianReport(report: any): Promise<any> {
    const id = randomUUID();
    const accessCode = this.generateAccessCode();
    const physicianReport = {
      id,
      accessCode,
      ...report,
      viewCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      reportDate: new Date(),
    };
    this.physicianReports.set(id, physicianReport);
    return physicianReport;
  }

  async getPhysicianReport(accessCode: string): Promise<any | undefined> {
    return Array.from(this.physicianReports.values()).find(
      (report) => report.accessCode === accessCode && report.isActive
    );
  }

  async getPhysicianReportById(id: string): Promise<any | undefined> {
    return this.physicianReports.get(id);
  }

  async getUserPhysicianReports(userId: string): Promise<any[]> {
    return Array.from(this.physicianReports.values())
      .filter((report) => report.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async trackPhysicianReportView(accessCode: string): Promise<void> {
    const report = await this.getPhysicianReport(accessCode);
    if (report) {
      report.viewCount = (report.viewCount || 0) + 1;
      report.lastViewedAt = new Date();
      this.physicianReports.set(report.id, report);
    }
  }

  private generateAccessCode(): string {
    // Generate a 12-character access code (e.g., "MPM-ABC-1234")
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let code = 'MPM-';
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code += '-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Glucose log methods
  async getGlucoseLogs(userId: string, startDate?: Date, endDate?: Date): Promise<GlucoseLog[]> {
    let logs = Array.from(this.glucoseLogs.values()).filter(log => log.userId === userId);
    
    if (startDate) {
      logs = logs.filter(log => new Date(log.recordedAt) >= startDate);
    }
    
    if (endDate) {
      logs = logs.filter(log => new Date(log.recordedAt) <= endDate);
    }
    
    return logs.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async getLatestGlucoseLog(userId: string): Promise<GlucoseLog | undefined> {
    const logs = await this.getGlucoseLogs(userId);
    return logs[0]; // Already sorted by date descending
  }

  async createGlucoseLog(insertGlucoseLog: InsertGlucoseLog): Promise<GlucoseLog> {
    const id = randomUUID();
    const glucoseLog: GlucoseLog = {
      ...insertGlucoseLog,
      id,
      recordedAt: new Date(),
      relatedMealId: insertGlucoseLog.relatedMealId || null,
      insulinUnits: insertGlucoseLog.insulinUnits || null,
      notes: insertGlucoseLog.notes || null,
    };
    this.glucoseLogs.set(id, glucoseLog);
    return glucoseLog;
  }

  // Password reset methods
  async setPasswordResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    if (!user) return false;

    const updatedUser = {
      ...user,
      resetTokenHash: tokenHash,
      resetTokenExpires: expiresAt,
    };
    this.users.set(user.id, updatedUser);
    return true;
  }

  async getUserByResetToken(tokenHash: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(
      (u) => u.resetTokenHash === tokenHash && 
             u.resetTokenExpires && 
             u.resetTokenExpires > new Date()
    );
    return user;
  }

  async updatePasswordByResetToken(tokenHash: string, newPasswordHash: string): Promise<boolean> {
    const user = await this.getUserByResetToken(tokenHash);
    if (!user) return false;

    const updatedUser = {
      ...user,
      password: newPasswordHash,
      resetTokenHash: null,
      resetTokenExpires: null,
    };
    this.users.set(user.id, updatedUser);
    return true;
  }
}

export const storage = new MemStorage();
