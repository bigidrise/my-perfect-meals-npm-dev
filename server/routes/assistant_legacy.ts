import type { Request, Response } from "express";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}


/**
 * Legacy Avatar Assistant Handler
 * 
 * This is the current working avatar logic, unchanged.
 * Returns: { response: string } (converted to { text, captions, navigateTo? } format)
 */
export default async function legacyAssistant(req: Request, res: Response) {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.json({
        text: "Ask me anything about nutrition, fitness, mindset, or navigating the app!",
        captions: "Ask me anything about nutrition, fitness, mindset, or navigating the app!"
      });
    }

    // Comprehensive app knowledge for the AI assistant
    const appKnowledge = `
MY PERFECT MEALS APP FEATURES:

🏠 MAIN DASHBOARD:
- Shopping List: Smart grocery list with ingredient consolidation
- Today's Motivation: Daily inspirational content
- Quick access to all major features

📅 MEAL PLANNING:
- Weekly Meal Calendar (/weekly-meal-planning): Plan 7 days of meals with AI assistance, drag-and-drop editing
- Craving Creator (/craving-creator): Generate meals based on current cravings and preferences
- Holiday Feast (/holiday-feast): Create special occasion multi-course meals
- Potluck Planner (/potluck-planner): Plan perfect potluck dishes with colorful interface

🍽️ FOOD & DINING:
- Restaurant Guide (/restaurant-guide): Healthy options at 50+ restaurants (McDonald's, Chipotle, etc.)
- Fridge Rescue (/fridge-rescue): Create meals from ingredients you already have
- Kids Meals Hub (/kids-hub): 8 kid-friendly meal planning features including lunchbox planner

📊 HEALTH & PROGRESS:
- My Progress (/my-progress): 8 comprehensive health tracking pages
- Men's Health (/mens-health): Hormone health and nutritional science  
- Women's Health (/womens-health): Cycle tracking, pregnancy support, body composition
- Complete Profile (/profile): Multi-step health profile with 8 sections
- Wellness Companion: Mental health and budget shopping features
- Success Stories: Community features and achievement tracking

🎯 SPECIALIZED FEATURES:
- Alcohol & Spirits Hub (/alcohol-hub): Responsible alcohol pairing and tracking
- Private Mental Health Q&A: AI-powered mental health support
- Meal Reminders: Smart notification system
- Medical Personalization: All meals consider health conditions, allergies, diabetes

⚙️ ACCOUNT & SETTINGS:
- Profile Editor (/profile): Edit health data, dietary restrictions, goals
- Onboarding (/onboarding): Initial health assessment and setup

💎 SUBSCRIPTION TIERS:
- Basic: Core meal planning features
- Upgrade: Restaurant guide, advanced tracking  
- Ultimate: Full feature access including potluck planner, complete health ecosystem

🔧 NAVIGATION:
- Use purple dev controls (bottom-left) for testing and navigation shortcuts
- Shopping list button (maroon) for quick grocery access
- Avatar assistant (that's me!) for help and guidance`;

    const systemPrompt = `You are Maya, the friendly AI health concierge for My Perfect Meals app. You help users navigate the app and understand features.

USER CONTEXT:
- Name: ${context?.userName || "there"}
- Current Page: ${context?.currentPage || "unknown"}
- Health Streak: ${context?.streak || 0} days
- Badges Earned: ${context?.badges || 0}

${appKnowledge}

PERSONALITY:
- Warm, encouraging, and knowledgeable
- Keep responses conversational (2-3 sentences max)
- Sound natural when spoken aloud
- Always be helpful and guide users clearly
- Reference their progress when relevant
- Use "you can" instead of "users can"

RESPONSE GUIDELINES:
- Give clear, actionable guidance
- Mention specific page routes when helpful (like /weekly-meal-planning)
- Celebrate user achievements when appropriate
- If unsure about something, admit it but offer general help

User question: "${message}"`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || "I'm here to help! What would you like to know?";

    // Smart navigation detection for voice commands
    const detectNavigation = (userMessage: string, aiResponse: string): string | undefined => {
      const msg = userMessage.toLowerCase();
      const response = aiResponse.toLowerCase();
      
      // Direct navigation commands
      if (msg.includes('go to') || msg.includes('take me to') || msg.includes('navigate to') || msg.includes('open')) {
        // Blood Sugar Hub
        if (msg.includes('blood sugar') || msg.includes('glucose') || msg.includes('glycemic')) {
          return '/blood-sugar-hub';
        }
        // Women's Health Hub
        if (msg.includes("women's health") || msg.includes('womens health') || msg.includes('women health')) {
          return '/womens-health';
        }
        // Men's Health Hub  
        if (msg.includes("men's health") || msg.includes('mens health') || msg.includes('men health')) {
          return '/mens-health';
        }
        // Meal Planning
        if (msg.includes('meal plan') || msg.includes('weekly meal') || msg.includes('meal calendar')) {
          return '/weekly-meal-planning';
        }
        // Craving Creator
        if (msg.includes('craving') || msg.includes('craving creator')) {
          return '/craving-creator';
        }
        // Profile/Onboarding
        if (msg.includes('profile') || msg.includes('my profile') || msg.includes('onboarding')) {
          return '/profile';
        }
        // Dashboard/Home
        if (msg.includes('dashboard') || msg.includes('home') || msg.includes('main page')) {
          return '/';
        }
        // Kids Hub
        if (msg.includes('kids') || msg.includes('children') || msg.includes('kid meal')) {
          return '/kids-hub';
        }
        // Restaurant Guide
        if (msg.includes('restaurant') || msg.includes('dining out')) {
          return '/restaurant-guide';
        }
        // Progress Tracking - route to biometrics since my-progress doesn't exist
        if (msg.includes('progress') || msg.includes('my progress') || msg.includes('tracking') || msg.includes('biometrics')) {
          return '/my-biometrics';
        }
      }
      
      // Check if AI response mentions specific routes
      if (response.includes('/weekly-meal-planning')) return '/weekly-meal-planning';
      if (response.includes('/craving-creator')) return '/craving-creator';
      if (response.includes('/blood-sugar-hub')) return '/blood-sugar-hub';
      if (response.includes('/womens-health')) return '/womens-health';
      if (response.includes('/mens-health')) return '/mens-health';
      if (response.includes('/profile')) return '/profile';
      if (response.includes('/kids-hub')) return '/kids-hub';
      if (response.includes('/restaurant-guide')) return '/restaurant-guide';
      if (response.includes('/my-progress') || response.includes('my progress')) return '/my-biometrics';
      
      return undefined;
    };

    const navigateTo = detectNavigation(message, responseText);

    // Convert legacy response format to new format with navigation support
    return res.json({
      text: responseText,
      captions: responseText,
      navigateTo
    });
  } catch (error) {
    console.error("Legacy avatar assistant error:", error);
    return res.json({
      text: "Sorry, I'm having trouble responding right now. Please try again!",
      captions: "Sorry, I'm having trouble responding right now. Please try again!"
    });
  }
}