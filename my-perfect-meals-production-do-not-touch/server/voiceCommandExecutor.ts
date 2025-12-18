import { storage } from './storage';
import { VoiceCommandResponse } from './voiceCommandParser';

export class VoiceCommandExecutor {
  
  async executeCommand(response: VoiceCommandResponse, userId?: string): Promise<VoiceCommandResponse> {
    try {
      switch (response.action) {
        case 'navigate':
          return this.handleNavigation(response);
          
        case 'logMeal':
          return await this.handleMealLogging(response, userId);
          
        case 'fetchData':
          return await this.handleDataFetch(response, userId);
          
        case 'encouragement':
          return this.handleEncouragement(response, userId);
          
        case 'generateMeal':
          return this.handleMealGeneration(response);
          
        default:
          return response; // Pass through other actions
      }
    } catch (error) {
      console.error('Command execution error:', error);
      return {
        action: "error",
        speech: "I encountered an error processing your request. Please try again."
      };
    }
  }

  private handleNavigation(response: VoiceCommandResponse): VoiceCommandResponse {
    // Navigation is handled by frontend, just return the response
    return response;
  }

  private async handleMealLogging(response: VoiceCommandResponse, userId?: string): Promise<VoiceCommandResponse> {
    if (!userId) {
      return {
        action: "error",
        speech: "I need you to be logged in to log meals."
      };
    }

    const mealType = response.data?.mealType;
    if (!mealType) {
      return {
        action: "navigate",
        data: "/log-meals",
        speech: "Let me open the meal logging page for you. What would you like to log?"
      };
    }

    // Route to specific meal logging with pre-selected meal type
    return {
      action: "navigate",
      data: `/log-meals?meal=${mealType}`,
      speech: `Opening ${mealType} logging for you. What did you eat?`
    };
  }

  private async handleDataFetch(response: VoiceCommandResponse, userId?: string): Promise<VoiceCommandResponse> {
    if (!userId) {
      return {
        action: "error",
        speech: "I need you to be logged in to access your data."
      };
    }

    const { type, timeframe } = response.data || {};
    
    try {
      switch (type) {
        case 'weight':
          return await this.fetchWeightData(userId, timeframe);
        case 'meals':
          return await this.fetchMealData(userId, timeframe);
        case 'progress':
          return await this.fetchProgressData(userId, timeframe);
        default:
          return {
            action: "navigate",
            data: "/my-biometrics",
            speech: "Let me show you your biometrics dashboard where you can see all your data."
          };
      }
    } catch (error) {
      return {
        action: "error",
        speech: "I'm having trouble accessing your data right now. Please try again."
      };
    }
  }

  private async fetchWeightData(userId: string, timeframe: string): Promise<VoiceCommandResponse> {
    // TODO: Integrate with actual weight tracking data
    // For now, navigate to progress page
    return {
      action: "navigate",
      data: "/my-biometrics?tab=weight",
      speech: `Let me show you your weight progress. I'm opening your weight tracking data.`
    };
  }

  private async fetchMealData(userId: string, timeframe: string): Promise<VoiceCommandResponse> {
    // TODO: Integrate with meal logging data
    return {
      action: "navigate", 
      data: "/meal-history",
      speech: `Here's your meal history. I can see what you've been eating.`
    };
  }

  private async fetchProgressData(userId: string, timeframe: string): Promise<VoiceCommandResponse> {
    return {
      action: "navigate",
      data: "/my-biometrics",
      speech: "Opening your complete biometrics dashboard. You're doing great!"
    };
  }

  private handleEncouragement(response: VoiceCommandResponse, userId?: string): VoiceCommandResponse {
    const mood = response.data?.mood || 'general';
    
    // Determine which health hub to open based on user profile
    // TODO: Get user gender from profile to route to men's vs women's health
    const healthHub = "/womens-health"; // Default, should be dynamic based on user
    
    const encouragements = [
      "You're stronger than you think. Let me show you some wellness tips that might help.",
      "I believe in you! Sometimes we all need a little extra support. Let's check out some encouraging resources.",
      "Remember, every small step counts. You're making progress even when it doesn't feel like it.",
      "You've got this! Let me share some inspiration and practical tips to help you feel better."
    ];
    
    const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
    
    return {
      action: "navigate",
      data: healthHub,
      speech: randomEncouragement
    };
  }

  private handleMealGeneration(response: VoiceCommandResponse): VoiceCommandResponse {
    const craving = response.data?.craving;
    
    if (craving) {
      return {
        action: "navigate",
        data: `/craving-creator?craving=${encodeURIComponent(craving)}`,
        speech: `I'll help you create something delicious with ${craving}. Let me open the craving creator!`
      };
    }
    
    return {
      action: "navigate",
      data: "/craving-creator",
      speech: "Let me help you create a delicious meal! What are you craving today?"
    };
  }
}