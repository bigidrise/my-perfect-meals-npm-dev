import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface VoiceCommandResponse {
  action: string;
  data?: any;
  speech: string;
}

export class VoiceCommandParser {
  
  async parseCommand(transcript: string, userId?: string): Promise<VoiceCommandResponse> {
    try {
      // Get user context if available
      const userContext = userId ? await this.getUserContext(userId) : null;
      
      const prompt = this.buildPrompt(transcript, userContext);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a helpful chef assistant that parses voice commands and returns structured responses. Always respond in JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return this.validateResponse(result);
      
    } catch (error) {
      console.error('Voice command parsing error:', error);
      return {
        action: "error",
        speech: "I'm sorry, I didn't understand that. Could you try again?"
      };
    }
  }

  private buildPrompt(transcript: string, userContext: any): string {
    return `
Parse this voice command and return a JSON response with action, data, and speech fields.

User said: "${transcript}"

User context: ${userContext ? JSON.stringify(userContext) : 'Unknown user'}

Available actions:
- "navigate" - Go to a specific page (data: route path as string)
- "logMeal" - Log a meal (data: {mealType, time})
- "fetchData" - Get user data (data: {type, timeframe})
- "encouragement" - Provide motivational support
- "generateMeal" - Create meal suggestions
- "error" - Command not understood

Available routes (use DASHBOARD CARD NAMES, not internal routes):
- "Dashboard" → /dashboard - Main dashboard
- "AI Meal Creator" → /ai-meal-creator - AI meal generation
- "Weekly Meal Planner" → /weekly-meal-calendar-new - Weekly meal calendar
- "🍽️ Meals for Kids" → /meals-for-kids - Kid-friendly meals
- "Craving Creator" → /craving-creator - Create custom meals
- "Supplement Hub" → /supplement-hub - Browse supplements
- "Potluck Planner" → /potluck-planner - Party and event meals  
- "Restaurant Guide" → /restaurant-guide - Find restaurants
- "Fridge Rescue" → /fridge-rescue - Use leftover ingredients
- "👩‍🍳 Learn to Cook Club" → /learn-to-cook - Cooking tutorials
- "Daily Journal" → /daily-journal - Daily journaling and meal logging
- "Meal Journal" → /daily-journal - Same as Daily Journal
- "Journal" → /daily-journal - Same as Daily Journal
- "Log Meals" → /log-meals - Log meals and nutrition
- "Meal Logging" → /log-meals - Same as Log Meals
- "Log Water" → /track-water - Track water intake
- "Water Log" → /track-water - Same as Log Water
- "Water Tracking" → /track-water - Same as Log Water
- "Track Water" → /track-water - Same as Log Water
- "My Biometrics" → /my-biometrics - Weight and health tracking
- "Biometrics" → /my-biometrics - Same as My Biometrics
- "Women's Health" → /womens-health - Women's health hub
- "Men's Health" → /mens-health - Men's health hub
- "Game Hub" → /game-hub - Game library and hub
- "🎄 Holiday Feast Creator" → /holiday-feast - Holiday meal planning
- "Master Shopping List" → /master-shopping-list - Shopping history
- "🩺 Lab Value Support" → /lab-values - Lab result meals
- "Meal Planning Hub" → /comprehensive-meal-planning-revised - Main meal hub
- "Log Meal" → /log-meals - Log meals and nutrition (hidden)
- "My Biometrics" → /my-biometrics - Weight and health tracking (hidden)
- "Women's Health" → /womens-health - Women's health hub (hidden)
- "Men's Health" → /mens-health - Men's health hub (hidden)
- "Game Hub" → /game-hub - Game library and hub (hidden)

Example commands (IMPORTANT: Use exact dashboard card names in speech):
- "Hey Chef, what's for breakfast?" → {"action": "navigate", "data": "/craving-creator", "speech": "Let me help you create a delicious meal! Opening Craving Creator for you."}
- "log breakfast" → {"action": "navigate", "data": "/log-meals", "speech": "Let me help you log your breakfast. What did you eat?"}
- "restaurant guide" → {"action": "navigate", "data": "/restaurant-guide", "speech": "Opening Restaurant Guide for you!"}
- "we're going out for dinner tonight" → {"action": "navigate", "data": "/restaurant-guide", "speech": "Perfect! Let me open Restaurant Guide to help you find healthy options."}
- "how much did I weigh last month" → {"action": "navigate", "data": "/my-biometrics", "speech": "Let me check your weight history for you."}
- "weekly meal plan" → {"action": "navigate", "data": "/weekly-meal-calendar-new", "speech": "Opening Weekly Meal Planner for you!"}
- "kids meals" → {"action": "navigate", "data": "/meals-for-kids", "speech": "Opening 🍽️ Meals for Kids for you!"}
- "cooking tips" → {"action": "navigate", "data": "/learn-to-cook", "speech": "Opening 👩‍🍳 Learn to Cook Club for you!"}
- "ai meal creator" → {"action": "navigate", "data": "/ai-meal-creator", "speech": "Opening AI Meal Creator for you!"}

IMPORTANT: Always provide a route in data field for navigate actions. The route must start with "/" and be a valid path.

Return JSON with:
{
  "action": "string",
  "data": "route_path_string_for_navigate_or_object_for_other_actions",
  "speech": "what the chef should say back"
}
`;
  }

  private async getUserContext(userId: string): Promise<any> {
    // This will integrate with existing user storage
    try {
      // TODO: Get user profile data, recent meals, health info
      return {
        hasProfile: true,
        // Will populate with actual user data
      };
    } catch (error) {
      return null;
    }
  }

  private validateResponse(response: any): VoiceCommandResponse {
    if (!response.action || !response.speech) {
      return {
        action: "error",
        speech: "I'm having trouble understanding. Could you repeat that?"
      };
    }
    
    return {
      action: response.action,
      data: response.data || null,
      speech: response.speech
    };
  }
}